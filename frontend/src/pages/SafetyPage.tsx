import { useTranslation } from 'react-i18next';

export function SafetyPage() {
  const { i18n } = useTranslation();
  const zh = i18n.language.startsWith('zh');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-800">
      <h1 className="text-xl font-semibold text-slate-950">
        {zh ? '安全与隐私' : 'Safety & privacy'}
      </h1>
      <div className="mt-4 space-y-3">
        <p>
          {zh
            ? 'Glowtype 尽量只收集提供服务所必需的最少数据。你不需要登录或注册就可以完成测试或使用基础聊天功能。'
            : 'Glowtype tries to collect the minimum data needed to provide this service. You do not need an account to use the quiz or basic chat.'}
        </p>
        <p>
          {zh
            ? '我们不会接入广告追踪或重定向营销代码。服务器日志中只会记录必要的技术信息（例如时间、路径、状态码），不会用来做用户画像。'
            : 'We do not include ad tracking or remarketing code. Server logs focus on technical info (time, path, status) and are not used to build marketing profiles.'}
        </p>
        <p>
          {zh
            ? '聊天内容目前只会在会话期间暂时保留，用于生成回复，而不会与身份信息绑定。如果未来需要用于改进服务，将会做匿名化处理并更新隐私说明。'
            : 'Chat messages are currently kept only in memory during your session to generate replies, and are not attached to identifying details. If we ever want to analyse them for improvement, we will anonymise and update this page first.'}
        </p>
        <p>
          {zh
            ? 'Glowtype 不是医疗或心理诊断工具，也不能替代专业的心理咨询或精神科就诊。如果你感到自己处于严重危险或有强烈自伤想法，请优先联系当地急救电话或心理热线。'
            : 'Glowtype is not a medical or diagnostic tool and does not replace therapy or psychiatric care. If you feel in serious danger or have strong self-harm thoughts, please prioritise contacting local emergency services or a crisis hotline.'}
        </p>
      </div>
    </div>
  );
}
