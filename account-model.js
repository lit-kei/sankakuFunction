export function accountEmail(type,identifier) {
  const input=String(identifier||'').trim();
  if(type==='school') {
    if(!/^\d{7}$/.test(input))throw Error('生徒番号を半角数字7桁で入力してください。');
    return `${input}@school.local`;
  }
  if(type!=='general'||!/^\S+@[^\s@]+\.[^\s@]+$/.test(input)||input.toLowerCase().endsWith('@school.local'))throw Error('有効なメールアドレスを入力してください。');
  return input;
}
export function validateRegistration(input,identity) {
  const username=String(input?.username||'').trim();
  if(!/^[A-Za-z0-9_-]{3,10}$/.test(username))throw Error('ユーザー名は半角英数字・ハイフン・アンダースコアで3〜10文字にしてください。');
  if(identity?.provider!=='password')throw Error('メールアドレスまたは生徒番号でログインしてください。');
  const type=input.accountType;
  const email=accountEmail(type,type==='school'?input.studentNumber:identity.email);
  if(email.toLowerCase()!==String(identity.email||'').toLowerCase())throw Error('ログイン情報と生徒番号が一致しません。');
  const publicProfile={username,accountType:type,schoolVerified:false};
  let privateProfile={accountType:type};
  if(type==='school') {
    for(const [field,max] of [['grade',3],['classNumber',7],['attendanceNumber',41]]) {
      if(!Number.isInteger(input[field])||input[field]<1||input[field]>max)throw Error('学年・クラス・出席番号を正しく選択してください。');
    }
    privateProfile={...privateProfile,studentNumber:String(input.studentNumber).trim(),grade:input.grade,classNumber:input.classNumber,attendanceNumber:input.attendanceNumber};
  }
  return {publicProfile,privateProfile};
}
export function authError(error) {
  const errors={
    'auth/invalid-credential':'生徒番号・メールアドレスまたはパスワードが正しくありません。',
    'auth/invalid-login-credentials':'生徒番号・メールアドレスまたはパスワードが正しくありません。',
    'auth/user-not-found':'生徒番号・メールアドレスまたはパスワードが正しくありません。',
    'auth/wrong-password':'生徒番号・メールアドレスまたはパスワードが正しくありません。',
    'auth/email-already-in-use':'すでに登録されています。ログインに切り替えてください。',
    'auth/weak-password':'パスワードは8文字以上で設定してください。',
    'auth/invalid-email':'メールアドレスを確認してください。',
    'auth/operation-not-allowed':'ログイン方法がまだ有効になっていません。管理者にお知らせください。',
    'auth/too-many-requests':'試行回数が多いため、少し待ってから再試行してください。',
    'auth/network-request-failed':'通信できませんでした。接続を確認してください。',
    'functions/unavailable':'アカウント登録の準備中です。管理者にお知らせください。',
    'functions/not-found':'アカウント登録の準備中です。管理者にお知らせください。',
    'functions/internal':'処理に失敗しました。少し待ってから再試行してください。',
  };
  return errors[error.code]||error.message||'処理に失敗しました。もう一度お試しください。';
}
