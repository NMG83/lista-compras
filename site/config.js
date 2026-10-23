// CONFIGURAÇÃO PÚBLICA do SDK Firebase. Estes valores não são segredos.
// Preenche a partir de Firebase Console > Project settings > Your apps > Web app.
window.MENU_COMPRAS_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    appId: ""
  },
  householdId: "familia",
  householdName: "Rodrigues Gonçalves",
  // No site de produção, podes alterar para false para ocultar a demonstração.
  allowDemo: true,
  // Só funciona no Netlify após configurar a função e segredos no servidor.
  aiEnabled: true
};