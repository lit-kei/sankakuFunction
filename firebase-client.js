import {firebaseConfig} from './firebase-config.js';
let services;
export function getServices(){
  return services??=(async()=>{
    const base='https://www.gstatic.com/firebasejs/11.10.0/';
    const [appSDK,authSDK,dbSDK,fnSDK]=await Promise.all(['app','auth','database','functions'].map(name=>import(`${base}firebase-${name}.js`)));
    const app=appSDK.getApps().length?appSDK.getApp():appSDK.initializeApp(firebaseConfig);
    const auth=authSDK.getAuth(app);
    await authSDK.setPersistence(auth,authSDK.browserLocalPersistence);
    await auth.authStateReady();
    return {app,auth,db:dbSDK.getDatabase(app),functions:fnSDK.getFunctions(app,'us-central1'),authSDK,dbSDK,fnSDK};
  })();
}
export async function getProfile(){
  const {auth,db,dbSDK}=await getServices();
  if(!auth.currentUser||auth.currentUser.isAnonymous)return null;
  return (await dbSDK.get(dbSDK.ref(db,`trigBattle/profiles/${auth.currentUser.uid}`))).val();
}
