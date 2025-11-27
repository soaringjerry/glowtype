import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
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
        {isZh ? '隐私政策' : 'Privacy Policy'}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {isZh ? '最后更新：2024年12月' : 'Last updated: December 2024'}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '1. 信息收集' : '1. Information We Collect'}
          </h2>
          <p className="mb-3">
            {isZh
              ? 'Glowtype.me 致力于最小化数据收集。以下是我们可能收集的信息：'
              : 'Glowtype.me is committed to minimizing data collection. Here is the information we may collect:'}
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              <strong>{isZh ? '测试答案：' : 'Quiz Responses: '}</strong>
              {isZh
                ? '你的测试答案仅用于生成结果，不会与任何个人身份信息关联。'
                : 'Your quiz answers are used only to generate results and are not linked to any personally identifiable information.'}
            </li>
            <li>
              <strong>{isZh ? '聊天内容：' : 'Chat Messages: '}</strong>
              {isZh
                ? '与 AI 的对话仅在会话期间临时存储，用于生成回复。会话结束后，这些数据不会被保留。'
                : 'Conversations with the AI are temporarily stored only during your session to generate responses. This data is not retained after the session ends.'}
            </li>
            <li>
              <strong>{isZh ? '技术数据：' : 'Technical Data: '}</strong>
              {isZh
                ? '标准服务器日志（如访问时间、页面路径、状态码）用于维护服务稳定性，不会用于用户追踪。'
                : 'Standard server logs (such as access time, page path, status code) are used to maintain service stability and are not used for user tracking.'}
            </li>
            <li>
              <strong>{isZh ? '语言偏好：' : 'Language Preference: '}</strong>
              {isZh
                ? '你的语言选择存储在浏览器本地存储中，方便下次访问。'
                : 'Your language choice is stored in browser local storage for convenience on future visits.'}
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '2. 我们不收集的信息' : '2. Information We Do NOT Collect'}
          </h2>
          <ul className="ml-4 list-disc space-y-2">
            <li>{isZh ? '姓名、邮箱、电话号码等个人身份信息' : 'Personal identifiers like name, email, or phone number'}</li>
            <li>{isZh ? '精确地理位置' : 'Precise geolocation'}</li>
            <li>{isZh ? '支付或财务信息' : 'Payment or financial information'}</li>
            <li>{isZh ? '社交媒体账户信息' : 'Social media account information'}</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '3. Cookie 和追踪' : '3. Cookies and Tracking'}
          </h2>
          <p>
            {isZh
              ? '我们不使用广告追踪、重定向营销或第三方分析工具。我们可能使用必要的功能性 Cookie 来维持基本服务功能（如语言偏好），但不会用于追踪你的浏览行为。'
              : 'We do not use advertising tracking, remarketing, or third-party analytics tools. We may use essential functional cookies to maintain basic service functionality (such as language preference), but not to track your browsing behavior.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '4. 数据存储与安全' : '4. Data Storage and Security'}
          </h2>
          <p>
            {isZh
              ? '所有数据传输通过 HTTPS 加密。测试结果和聊天内容主要在你的浏览器会话中处理。我们采取合理的技术措施保护服务器端的任何临时数据。'
              : 'All data transmission is encrypted via HTTPS. Quiz results and chat content are primarily processed in your browser session. We take reasonable technical measures to protect any temporary data on our servers.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '5. 第三方服务' : '5. Third-Party Services'}
          </h2>
          <p>
            {isZh
              ? 'AI 聊天功能由第三方 AI 服务提供支持。你与 AI 的对话可能会被发送到这些服务进行处理。我们选择重视用户隐私的服务提供商，但建议你不要在聊天中分享敏感的个人信息。'
              : 'The AI chat feature is powered by third-party AI services. Your conversations with the AI may be sent to these services for processing. We choose service providers that value user privacy, but we recommend not sharing sensitive personal information in chat.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '6. 未成年人隐私' : '6. Children\'s Privacy'}
          </h2>
          <p>
            {isZh
              ? '本服务面向 15 岁及以上用户。我们不会故意收集 15 岁以下儿童的个人信息。如果你是家长或监护人，发现你的孩子向我们提供了个人信息，请联系我们。'
              : 'This service is intended for users aged 15 and above. We do not knowingly collect personal information from children under 15. If you are a parent or guardian and discover that your child has provided us with personal information, please contact us.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '7. 你的权利' : '7. Your Rights'}
          </h2>
          <p>
            {isZh
              ? '由于我们不收集可识别的个人信息，因此没有与你身份关联的数据可供访问、更正或删除。如果你对我们的数据实践有任何疑问，欢迎联系我们。'
              : 'Since we do not collect identifiable personal information, there is no data associated with your identity to access, correct, or delete. If you have any questions about our data practices, please feel free to contact us.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '8. 政策变更' : '8. Policy Changes'}
          </h2>
          <p>
            {isZh
              ? '我们可能会不时更新本隐私政策。任何重大变更将在本页面公布。继续使用服务即表示接受更新后的政策。'
              : 'We may update this privacy policy from time to time. Any significant changes will be posted on this page. Continued use of the service constitutes acceptance of the updated policy.'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-medium text-slate-900">
            {isZh ? '9. 联系我们' : '9. Contact Us'}
          </h2>
          <p>
            {isZh
              ? '如果你对本隐私政策有任何疑问或顾虑，请通过我们的帮助页面联系我们。'
              : 'If you have any questions or concerns about this privacy policy, please contact us through our help page.'}
          </p>
        </section>
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <p className="text-xs text-slate-400">
          {isZh
            ? '使用 Glowtype.me 即表示你已阅读并理解本隐私政策。'
            : 'By using Glowtype.me, you acknowledge that you have read and understood this privacy policy.'}
        </p>
      </div>
    </div>
  );
}
