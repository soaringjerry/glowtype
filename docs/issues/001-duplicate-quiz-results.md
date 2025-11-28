# Issue #001: 测验结果重复记录问题

**日期**: 2025-11-28
**状态**: 已修复
**影响范围**: 后台数据统计准确性

---

## 问题描述

后台结果记录中发现部分重复记录，用户完成一次测试却记录了两条甚至更多结果。

### 复现场景

1. **网络不稳定时的重复提交**
   - 用户完成最后一题 → 发送 POST `/quiz/score`
   - 前端收到响应超时/网络断开
   - 用户点击"重试" → 再次发送请求
   - 后端生成新 UUID 作为 SessionID，创建新记录
   - **结果**: 两条相同答案的记录

2. **快速双击提交**
   - 用户快速点击两次最后一个选项
   - 两个请求都发送到后端
   - 后端无法区分是重复请求
   - **结果**: 创建两条记录

3. **刷新页面导致的重复**（边缘情况）
   - 用户完成测试，看到结果
   - 后端异步保存正在进行中
   - 用户刷新页面重新开始并再次完成
   - **结果**: 同一用户多条记录

---

## 根因分析

### 1. 后端缺陷 (`internal/services/quiz_service.go:137`)

```go
// 问题：每次请求都生成新的 UUID，无法识别重复提交
SessionID: uuid.New().String(),
```

### 2. 前端缺陷 (`frontend/src/App.tsx:459-476`)

```typescript
// 问题：没有幂等性令牌，没有防重复点击
const res = await fetch(`${window.location.origin}/api/v1/quiz/score`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

### 3. 数据库缺陷 (`internal/database/models.go:191`)

```go
// 问题：SessionID 只有普通索引，没有唯一约束
SessionID string `gorm:"index;not null" json:"sessionId"`
```

### 问题总结

| 组件 | 问题 | 风险等级 |
|-----|------|---------|
| 前端 | 无幂等性令牌 | 高 |
| 前端 | 无防重复点击 | 中 |
| 后端 | 每次生成新 SessionID | 高 |
| 后端 | 使用 Create 而非 Upsert | 高 |
| 数据库 | SessionID 无唯一约束 | 高 |

---

## 解决方案

### 1. 前端：生成幂等性令牌 + 防重复提交

**文件**: `frontend/src/App.tsx`

```typescript
const QuizView = ({ onComplete, lang }: QuizViewProps) => {
  // ... existing state ...
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 在测试开始时生成唯一 session ID（幂等性令牌）
  const [quizSessionId] = useState(() => crypto.randomUUID());

  const handleAnswer = async (value: string) => {
    // ... handle intermediate questions ...

    // 最后一题提交时
    if (isSubmitting) return;  // 防止重复点击
    setIsSubmitting(true);

    const payload = {
      quizId,
      quizSessionId,  // 幂等性令牌
      language,
      answers
    };

    try {
      const res = await fetch('/api/v1/quiz/score', { ... });
      // ...
    } catch (e) {
      setIsSubmitting(false);  // 失败时允许重试
    }
  };
};
```

### 2. 后端：使用前端 SessionID + Upsert 逻辑

**文件**: `internal/models/quiz.go`

```go
type QuizScoreRequest struct {
    QuizID        string       `json:"quizId"`
    QuizSessionId string       `json:"quizSessionId"` // 幂等性令牌
    Language      string       `json:"language"`
    Answers       []QuizAnswer `json:"answers"`
}
```

**文件**: `internal/services/quiz_service.go`

```go
func (s *QuizService) ScoreQuizWithMeta(req models.QuizScoreRequest, meta models.RequestMeta) models.QuizScoreResponse {
    // ... scoring logic ...

    // 使用前端提供的 session ID，如果没有则回退到生成新的
    sessionId := req.QuizSessionId
    if sessionId == "" {
        sessionId = uuid.New().String()
    }

    go s.saveQuizResult(sessionId, answers, result, req.Language, meta)
    // ...
}

func (s *QuizService) saveQuizResult(sessionId string, ...) {
    quizResult := database.QuizResultDB{
        SessionID: sessionId,
        // ...
    }

    // Upsert: 存在则忽略，不存在则插入
    s.db.Clauses(clause.OnConflict{
        Columns:   []clause.Column{{Name: "session_id"}},
        DoNothing: true,
    }).Create(&quizResult)
}
```

### 3. 数据库：添加唯一约束 + 数据迁移

**文件**: `internal/database/models.go`

```go
type QuizResultDB struct {
    // ...
    // 从 index 改为 uniqueIndex
    SessionID string `gorm:"uniqueIndex;not null" json:"sessionId"`
    // ...
}
```

**文件**: `internal/database/database.go`

```go
// 迁移函数：清理现有重复数据
func migrateQuizResultsUniqueSessionID(db *gorm.DB) {
    // 检查并删除重复记录（保留最早的）
    var duplicateCount int64
    db.Raw(`
        SELECT COUNT(*) FROM (
            SELECT session_id FROM quiz_results
            GROUP BY session_id HAVING COUNT(*) > 1
        )
    `).Scan(&duplicateCount)

    if duplicateCount > 0 {
        db.Exec(`
            DELETE FROM quiz_results
            WHERE id NOT IN (
                SELECT MIN(id) FROM quiz_results GROUP BY session_id
            )
        `)
    }
}
```

---

## 防护机制总结

| 场景 | 防护层 | 机制 |
|-----|-------|------|
| 用户快速双击 | 前端 | `isSubmitting` 状态锁 |
| 网络超时重试 | 前端+后端 | 相同 `quizSessionId` + Upsert |
| 恶意重复请求 | 数据库 | 唯一约束兜底 |
| 刷新页面重做 | - | 新 sessionId = 新记录（正确行为） |

---

## 修改文件清单

| 文件 | 修改内容 |
|-----|---------|
| `frontend/src/App.tsx` | 添加 `quizSessionId` 和 `isSubmitting` |
| `backend/internal/models/quiz.go` | `QuizScoreRequest` 添加 `QuizSessionId` |
| `backend/internal/services/quiz_service.go` | 使用前端 sessionId + Upsert |
| `backend/internal/database/models.go` | `SessionID` 改为 `uniqueIndex` |
| `backend/internal/database/database.go` | 添加数据迁移函数 |

---

## 部署注意事项

1. **自动迁移**: 应用重启时会自动执行迁移，清理现有重复数据
2. **向后兼容**: 旧版前端（不发送 `quizSessionId`）会回退到后端生成 UUID
3. **日志监控**: 迁移时会打印清理的重复记录数量

```
[Migration] Found X duplicate session_ids in quiz_results, cleaning up...
[Migration] Removed X duplicate records
[Migration] Quiz results session_id migration complete
```

---

## 测试验证

```bash
# 构建后端
cd backend && go build ./...

# 运行测试
go test ./...

# 构建前端
cd frontend && npm run build
```

---

## 参考资料

- [GORM Upsert 文档](https://gorm.io/docs/create.html#Upsert-On-Conflict)
- [幂等性设计模式](https://en.wikipedia.org/wiki/Idempotence)
- [Web API 防重复提交最佳实践](https://stripe.com/docs/api/idempotent_requests)
