import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        {isZh ? '返回首页' : 'Back to Home'}
      </Link>

      <h1 className="text-2xl font-semibold text-slate-900">
        {isZh ? '用户条款' : 'Terms & Conditions'}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {isZh ? '最后更新：2024年12月' : 'Last updated: December 2024'}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '1. 服务说明' : '1. Service Description'}
          </h2>
          <p>
            {isZh
              ? 'Glowtype.me 是一款情绪探索工具，通过简短问答帮助用户了解自己的情绪倾向。本服务仅供娱乐和自我反思目的，不构成任何医疗、心理或专业诊断。'
              : 'Glowtype.me is an emotional exploration tool that helps users understand their emotional tendencies through a short questionnaire. This service is for entertainment and self-reflection purposes only and does not constitute any medical, psychological, or professional diagnosis.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '2. 使用资格' : '2. Eligibility'}
          </h2>
          <p>
            {isZh
              ? '本服务面向 15-25 岁的用户设计。如果你未满 18 岁，我们建议在使用前征得家长或监护人的同意。使用本服务即表示你同意遵守这些条款。'
              : 'This service is designed for users aged 15-25. If you are under 18, we recommend obtaining parental or guardian consent before use. By using this service, you agree to comply with these terms.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '3. 免责声明' : '3. Disclaimer'}
          </h2>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              {isZh
                ? '本服务不是医疗或心理健康诊断工具，无法替代专业的心理咨询或治疗。'
                : 'This service is not a medical or mental health diagnostic tool and cannot replace professional counseling or treatment.'}
            </li>
            <li>
              {isZh
                ? '测试结果仅供参考，不应被视为关于你心理健康状况的权威评估。'
                : 'Test results are for reference only and should not be considered authoritative assessments of your mental health.'}
            </li>
            <li>
              {isZh
                ? 'AI 聊天功能由人工智能驱动，可能产生不准确或不恰当的回复。'
                : 'The AI chat feature is powered by artificial intelligence and may produce inaccurate or inappropriate responses.'}
            </li>
            <li>
              {isZh
                ? '如果你正经历心理危机或有自我伤害的想法，请立即联系专业热线或急救服务。'
                : 'If you are experiencing a mental health crisis or thoughts of self-harm, please contact a professional hotline or emergency services immediately.'}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '4. 用户行为' : '4. User Conduct'}
          </h2>
          <p>
            {isZh
              ? '使用本服务时，你同意不会：发送违法、有害或骚扰性内容；尝试绕过系统安全措施；滥用 AI 聊天功能；或将服务用于任何非法目的。'
              : 'When using this service, you agree not to: send illegal, harmful, or harassing content; attempt to bypass system security measures; abuse the AI chat feature; or use the service for any illegal purposes.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '5. 知识产权' : '5. Intellectual Property'}
          </h2>
          <p>
            {isZh
              ? 'Glowtype.me 的所有内容、设计、代码和商标均为我们或其授权方的财产。未经书面许可，不得复制、修改或分发这些内容。'
              : 'All content, design, code, and trademarks of Glowtype.me are the property of us or our licensors. These materials may not be copied, modified, or distributed without written permission.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '6. 服务变更' : '6. Service Changes'}
          </h2>
          <p>
            {isZh
              ? '我们保留随时修改、暂停或终止服务的权利，恕不另行通知。我们也可能不时更新这些条款，继续使用服务即表示接受更新后的条款。'
              : 'We reserve the right to modify, suspend, or terminate the service at any time without notice. We may also update these terms from time to time, and continued use of the service constitutes acceptance of the updated terms.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '7. 责任限制' : '7. Limitation of Liability'}
          </h2>
          <p>
            {isZh
              ? '在法律允许的最大范围内，我们不对因使用或无法使用本服务而产生的任何直接、间接、偶然、特殊或后果性损害承担责任。'
              : 'To the maximum extent permitted by law, we shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use or inability to use this service.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '8. 联系我们' : '8. Contact Us'}
          </h2>
          <p>
            {isZh
              ? '如果你对这些条款有任何疑问，请通过我们的帮助页面联系我们。'
              : 'If you have any questions about these terms, please contact us through our help page.'}
          </p>
        </section>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-xs text-slate-400">
          {isZh
            ? '使用 Glowtype.me 即表示你已阅读、理解并同意这些条款。'
            : 'By using Glowtype.me, you acknowledge that you have read, understood, and agree to these terms.'}
        </p>
      </div>
    </div>
  );
}
