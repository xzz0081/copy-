import React from 'react';

const AuthGuide: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">授权系统使用指南</h1>
      
      <div className="space-y-6">
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">授权流程</h2>
          <ol className="list-decimal list-inside space-y-3">
            <li>使用用户名和密码登录，获取临时令牌</li>
            <li>使用TOTP验证码和临时令牌进行二次验证，获取JWT令牌</li>
            <li>系统自动在后续请求的Header中携带 Authorization: Bearer {'{JWT令牌}'}</li>
          </ol>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">首次登录</h2>
          <p className="mb-4">首次登录时，系统会要求您设置TOTP双因素认证：</p>
          <ol className="list-decimal list-inside space-y-3">
            <li>输入用户名和密码后，系统会显示TOTP二维码</li>
            <li>使用Google Authenticator、Microsoft Authenticator或其他TOTP应用扫描二维码</li>
            <li>输入应用生成的6位验证码完成设置</li>
            <li>设置完成后，每次登录都需要输入TOTP验证码</li>
          </ol>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">安全提示</h2>
          <ul className="list-disc list-inside space-y-3">
            <li>请妥善保管您的TOTP种子密钥，避免丢失</li>
            <li>不要与他人分享您的验证器应用或截图</li>
            <li>系统会在一段时间后自动登出，需要重新登录</li>
            <li>完成操作后请点击"退出登录"按钮安全退出</li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">推荐的验证器应用</h2>
          <ul className="list-disc list-inside space-y-3">
            <li>Google Authenticator (iOS/Android)</li>
            <li>Microsoft Authenticator (iOS/Android)</li>
            <li>Authy (iOS/Android/Desktop)</li>
            <li>1Password (密码管理器内置TOTP功能)</li>
          </ul>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">常见问题</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Q: 我的验证码总是提示错误，怎么办？</h3>
              <p className="text-gray-300">A: 请确认您的设备时间是否准确，TOTP验证依赖于精确的时间同步。</p>
            </div>
            
            <div>
              <h3 className="font-medium">Q: 我更换了手机，如何迁移验证器？</h3>
              <p className="text-gray-300">A: 如果您有备份的种子密钥，可以在新手机上重新设置。否则需要联系管理员重置您的TOTP。</p>
            </div>
            
            <div>
              <h3 className="font-medium">Q: 令牌有效期是多久？</h3>
              <p className="text-gray-300">A: JWT令牌默认有效期为24小时，过期后需要重新登录。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthGuide; 