# Menu & Compras — V2

Aplicação familiar em **português de Portugal**, mobile-first, sem framework no frontend.
Mantém as compras simples, acrescenta refeições e pode sincronizar entre dispositivos através do Firebase.

## O que está implementado

- Lista com categorias, sem categorias vazias, checkboxes, ordenação de pendentes primeiro, ocultar e limpar concluídos com confirmação.
- **Editar produto** ao tocar no nome; editar nome, categoria e supermercado.
- Categorização imediata por regras locais + preferências guardadas; classificação adicional por IA opcional.
- Preferências de produto partilhadas entre a família; a preferência manual tem prioridade sobre a IA.
- Refeições semanais de sábado a sexta-feira, almoço e jantar, vista móvel/desktop.
- Refeição fora de casa, editar/apagar, copiar para outra data e reutilizar histórico.
- Proposta de ingredientes por IA, revista e confirmada antes de entrar na lista; alguns pratos comuns funcionam com sugestões locais se a IA não estiver disponível.
- Assistente em chat para compras/refeições com voz quando suportada; ações propostas precisam de confirmação.
- Contas Firebase Authentication email/password, lista explícita de membros autorizados, regras fechadas para todos os outros.
- Modo demonstração: **não sincroniza com outros dispositivos**, dados guardados apenas no navegador.
- Instalação como atalho/app no ecrã principal através do navegador (PWA com manifesto; requer HTTPS em produção).

## MUITO IMPORTANTE — proteger a base V1 antes de lançar

O alerta Firebase diz que a base da V1 aceita leitura e escrita públicas. **Trocar GitHub Pages por Netlify, por si só, não corrige isto.**

1. Abre [Firebase Console](https://console.firebase.google.com/) → projeto **listacompras-f9c39** → Realtime Database → **Data** → menu → **Export JSON**. Guarda o backup num local privado.
2. Ainda no Realtime Database → **Rules**, se precisares de bloquear imediatamente a vulnerabilidade antes da V2, publica temporariamente: `{ "rules": { ".read": false, ".write": false } }`. **A V1 vai deixar de funcionar até a V2 estar configurada** — é o efeito esperado.
3. Não publiques o backup, emails, palavras-passe nem ficheiros `serviceAccount*.json` no GitHub/Netlify.
4. No final configura a autenticação, os membros, as regras V2 e a migração antes de voltares a utilizar a lista.

## Configuração Firebase (passo a passo)

1. Abre [Firebase Console](https://console.firebase.google.com/), escolhe **listacompras-f9c39**.
2. **Authentication → Sign-in method → Email/Password → Enable**.
3. **Authentication → Users → Add user** e cria manualmente **dois utilizadores** (cada adulto com o seu email e palavra-passe). Não existe registo público na V2.
4. Copia o **UID** de cada utilizador na lista de utilizadores do Firebase.
5. Em **Realtime Database → Data**, cria os seguintes caminhos **administrativamente** (a consola Firebase permite editar enquanto as regras impedem alterações dos clientes):

   ```json
   {
     "households": {
       "familia": {
         "members": {
           "UID_DO_ADULTO_1": true,
           "UID_DO_ADULTO_2": true
         }
       }
     }
   }
   ```
   **Atenção:** isto é um *fragmento*: não substituas o JSON inteiro se existirem dados na base. Acrescenta apenas os novos nós, preservando `lista` V1.
6. Em **Realtime Database → Rules**, cola o conteúdo completo de `firebase.rules.json` e publica. O caminho `/lista` antigo fica inacessível ao browser (mas mantém os dados para migração administrativa).
7. Em **Project settings → Your apps**, regista uma Web app, se ainda não tiveres uma. Copia a configuração pública do SDK para `site/config.js` (apiKey, authDomain, projectId, databaseURL, appId). Estas chaves de inicialização são públicas; **não confundas com uma service account**.
8. Em **Authentication → Settings → Authorized domains**, adiciona o domínio efetivo da app Netlify (por exemplo `nome-do-site.netlify.app`), se necessário, e remove domínios que já não usas.
9. Mantém `householdId: 'familia'` igual ao caminho configurado em RTDB. Os dois adultos podem entrar com as suas contas nos vários dispositivos.
10. Testa permissões: incógnito sem login → dados inacessíveis; login autorizado → dados visíveis; utilizador estranho → acesso negado; alterações num telefone → aparecem no outro.

> **Segurança:** as regras permitem ler os dados apenas a UIDs presentes em `/households/familia/members`. Um UID não autorizado não pode adicionar-se à lista. A administração dos membros é feita na consola Firebase. `auth !== null` sozinho **não** seria suficiente.

## Publicar no Netlify (recomendado)

1. Faz upload do projeto para um novo repositório GitHub (pode ser privado). **Não substituas já a V1.**
2. No [Netlify](https://app.netlify.com/) seleciona **Add new project → Import an existing project → GitHub**.
3. Escolhe o repositório. O `netlify.toml` já indica `publish = "site"` e a pasta das funções. Se o Netlify pedir, **Build command** pode ficar vazio, e **Publish directory** é `site`.
4. Publica o site; testa primeiro o login e depois a sincronização em dois dispositivos.
5. Se quiseres IA real, configura as variáveis seguintes em **Project configuration → Environment variables** e volta a publicar:

   - `OPENAI_API_KEY`: chave privada do serviço de IA (apenas no servidor).
   - `FIREBASE_PROJECT_ID`: ID do projeto Firebase.
   - `FIREBASE_CLIENT_EMAIL`: email da service account Firebase.
   - `FIREBASE_PRIVATE_KEY`: chave privada da service account (com quebras de linha; nunca no GitHub).
   - `FIREBASE_DATABASE_URL`: URL do Realtime Database Firebase.
   - `HOUSEHOLD_ID`: `familia`.
   - `OPENAI_MODEL` (opcional): `gpt-4o-mini`.

   A função `netlify/functions/ai.mjs` valida **cada pedido** com Firebase Authentication e verifica que o UID pertence à família. A IA **não** recebe credenciais administrativas e as ações só são executadas no browser após confirmação.

6. Antes de convidar a família, testa também o assistente; consulta os logs das Functions no Netlify em caso de falha. A IA pode gerar custos conforme o consumo, incluindo chamadas automáticas de classificação de produtos.

### Posso manter GitHub Pages?

Sim, para o frontend e Firebase. Mas **GitHub Pages só serve ficheiros estáticos**; a função de IA incluída neste projeto requer Netlify Functions (ou um backend equivalente). O frontend não deve conter a chave secreta de IA. Um repositório privado **não torna necessariamente o site GitHub Pages privado**.

### E Base44 ou Lovable?

São alternativas para reconstruir noutra plataforma. Para reduzir mudança visual, reutilizar a base Firebase e evitar custos/lock-in de uma migração completa, **esta versão mantém HTML + Firebase + Netlify**.

## Migrar os itens antigos V1, sem os apagar

Foi incluído o script **opcional** `scripts/migrar-v1.mjs`: lê o nó antigo `/lista` com privilégios de administrador e copia os artigos para `/households/familia/shoppingItems`, sem apagar a origem e sem sobrescrever IDs já migrados. A migração atribui inicialmente a categoria **Outros** aos artigos antigos, que podem depois ser reclassificados manualmente.

Para o executar em ambiente local Node (não no browser):

1. Firebase Console → **Project settings → Service accounts → Generate new private key**. Guarda o ficheiro **fora do repositório** e nunca o partilhes.
2. Instala dependências: `npm install` na pasta do projeto.
3. Define as variáveis de ambiente `GOOGLE_APPLICATION_CREDENTIALS` (caminho absoluto do JSON privado), `FIREBASE_DATABASE_URL` (endereço da tua RTDB) e opcionalmente `HOUSEHOLD_ID=familia`.
4. Corre `node scripts/migrar-v1.mjs`.
5. Compara os artigos da V2 com o backup antes de declarares a migração concluída. Mantém o backup privado.

## Testes sugeridos antes de substituir a V1

- Inserir, editar e concluir artigos em 2 dispositivos em simultâneo.
- Alterar categoria de “atum”, remover e adicionar “atum” novamente: deve usar a preferência aprendida.
- Semana atual, semana anterior, semana seguinte, “Fora de casa”, copiar e reutilizar refeições.
- Sugerir ingredientes, desmarcar um ingrediente e confirmar — apenas selecionados devem entrar na lista.
- Desligar acesso de um UID em `/members` e confirmar que perde o acesso após renovar sessão/recarregar.
- Testar modo incógnito sem login e um utilizador sem permissão.

## Notas e limitações honestas

- A demonstração está **totalmente isolada** dos dados reais e não testa a sincronização.
- A integração de IA é **opcional**: só fica funcional após configurar as variáveis e publicar as funções no Netlify. Sem isso, permanecem a classificação local, histórico e as sugestões simples de ingredientes. A demonstração reconhece apenas comandos locais básicos no chat.
- Os pedidos de IA enviados ao fornecedor incluem o texto do pedido e o contexto necessário das compras/refeições. Evita inserir dados sensíveis nas refeições ou no chat.
- Esta entrega é um **protótipo funcional para configuração e testes**, não uma aplicação já publicada ou ligada ao teu Firebase.
- Nenhuma credencial da tua conta foi incluída nos ficheiros.