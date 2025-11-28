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

### 方案演进

**V1 方案（有缺陷）**: 前端生成 quizSessionId + 后端 Upsert
- 问题：前端组件未正确卸载时，不同人用同一 sessionId 导致结果丢失

**V2 方案（当前）**: 后端答案哈希 + 时间窗口去重
- 优点：不依赖前端状态，更可靠

### 1. 前端：仅防止双击

**文件**: `frontend/src/App.tsx`

```typescript
const QuizView = ({ onComplete, lang }: QuizViewProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAnswer = async (value: string) => {
    // 最后一题提交时
    if (isSubmitting) return;  // 防止重复点击
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/v1/quiz/score', { ... });
      // ...
    } catch (e) {
      setIsSubmitting(false);  // 失败时允许重试
    }
  };
};
```

### 2. 后端：答案哈希 + 时间窗口去重

**文件**: `internal/services/quiz_service.go`

```go
// saveQuizResult saves the quiz result to the database for analytics
// Uses answers hash + time window to prevent duplicate submissions
// - Same answers within 30 seconds = duplicate (network retry), skip
// - Same answers after 30 seconds = different person, save
// - Different answers = always save
func (s *QuizService) saveQuizResult(answers []database.AnswerRecord, result *ScoringResult, language string, meta models.RequestMeta) {
    answersJSON, _ := json.Marshal(answers)
    answersHash := hashAnswers(answersJSON)

    // Check for duplicate: same answers hash within last 30 seconds
    var recentCount int64
    cutoffTime := time.Now().Add(-30 * time.Second)
    s.db.Model(&database.QuizResultDB{}).
        Where("answers_hash = ? AND created_at > ?", answersHash, cutoffTime).
        Count(&recentCount)

    if recentCount > 0 {
        log.Printf("[QuizService] Skipping duplicate submission")
        return
    }

    quizResult := database.QuizResultDB{
        SessionID:   uuid.New().String(),  // 每次生成新 ID
        AnswersHash: answersHash,
        // ...
    }
    s.db.Create(&quizResult)
}

func hashAnswers(answersJSON []byte) string {
    hash := sha256.Sum256(answersJSON)
    return hex.EncodeToString(hash[:])
}
```

### 3. 数据库：添加 AnswersHash 字段

**文件**: `internal/database/models.go`

```go
type QuizResultDB struct {
    ID          uint   `gorm:"primaryKey" json:"id"`
    SessionID   string `gorm:"index;not null" json:"sessionId"`
    AnswersHash string `gorm:"index;size:64" json:"answersHash"`  // SHA256 hash for dedup
    // ...
}
```

---

## 防护机制总结

| 场景 | 防护层 | 机制 |
|-----|-------|------|
| 用户快速双击 | 前端 | `isSubmitting` 状态锁 |
| 网络超时重试 | 后端 | 答案哈希 + 30秒时间窗口 |
| 同设备不同人做 | 后端 | 答案不同直接保存；答案相同超过30秒也保存 |
| 恶意重复请求 | 后端 | 答案哈希去重 |

---

## 修改文件清单

| 文件 | 修改内容 |
|-----|---------|
| `frontend/src/App.tsx` | 添加 `isSubmitting` 状态防双击 |
| `backend/internal/services/quiz_service.go` | 答案哈希 + 时间窗口去重 |
| `backend/internal/database/models.go` | 添加 `AnswersHash` 字段 |

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
