# 💀 Esqueleto de Componentes Discord.js

Este guia explica as estruturas utilizadas no arquivo `commands/utils/esqueleto.js`.

## 1. Embeds (`EmbedBuilder`)
São as caixas de texto formatadas com cores e imagens.
*   `.setTitle()`: Título principal.
*   `.setDescription()`: Corpo do texto.
*   `.addFields()`: Adiciona colunas de informação (use `inline: true` para colocar lado a lado).
*   `.setColor()`: Cor da barra lateral (Hexadecimal).

## 2. Botões (`ButtonBuilder`)
Botões clicáveis que ficam abaixo da mensagem.
*   `.setCustomId('id_unico')`: O ID invisível usado pelo código para saber qual botão foi clicado.
*   `.setLabel('Texto')`: O texto visível no botão.
*   `.setStyle()`: A cor do botão:
    *   `Primary`: Azul (Blurple)
    *   `Secondary`: Cinza
    *   `Success`: Verde
    *   `Danger`: Vermelho
    *   `Link`: Botão que abre URL (requer `.setURL` em vez de CustomId).

## 3. Menus de Seleção (`StringSelectMenuBuilder`)
Dropdowns para escolher uma ou mais opções.
*   `.addOptions()`: Recebe uma lista de `StringSelectMenuOptionBuilder`.
*   `.setPlaceholder()`: Texto que aparece antes de selecionar.
*   **Dica**: Use `i.values[0]` dentro do coletor para pegar o valor escolhido.

## 4. Action Rows (`ActionRowBuilder`)
O Discord exige que componentes (botões, menus, inputs) sejam colocados dentro de "linhas".
*   Cada linha pode ter até 5 botões **OU** 1 menu de seleção **OU** 1 input de texto (em modais).
*   Você passa as linhas no array `components: [linha1, linha2]` ao enviar a mensagem.

## 5. Modais (`ModalBuilder`)
Formulários pop-up para entrada de texto.
*   **Importante**: Modais só podem ser abertos em resposta direta a uma interação (clique de botão ou comando slash). Não podem ser enviados "do nada".
*   `TextInputBuilder`: Os campos do formulário.
    *   `TextInputStyle.Short`: Linha única (ex: Nome).
    *   `TextInputStyle.Paragraph`: Bloco de texto (ex: Biografia).
*   **Recebendo a Resposta**: Use `interaction.awaitModalSubmit()` para esperar o usuário enviar o formulário.
    *   Dentro do `await`, use `submissao.fields.getTextInputValue('id_do_input')` para pegar o valor de cada campo.

## 6. Coletores (Collectors)

Coletores são os "ouvidos" do bot que ficam esperando por uma ação específica do usuário por um tempo determinado. Existem diferentes tipos para diferentes interações.

### `createMessageComponentCollector` (Para Botões e Menus)
É o coletor mais comum, usado para ouvir cliques em botões e seleções em menus que estão em uma mensagem.
*   `filter`: Uma função que decide quais interações serão coletadas. É essencial para garantir que apenas o usuário que executou o comando possa interagir. Ex: `i => i.user.id === interaction.user.id`.
*   `time`: O tempo em milissegundos que o coletor ficará ativo. Após esse tempo, ele para.
*   **Eventos Principais**:
    *   `.on('collect', async i => { ... })`: É disparado para **cada** interação que passa pelo filtro. `i` é a interação (o clique no botão, por exemplo).
    *   `.on('end', collected => { ... })`: É disparado quando o tempo (`time`) acaba. Útil para desabilitar os botões e informar ao usuário que a interação expirou.

### Tratando Menus de Seleção (Dropdowns)
Dentro do evento `collect`, você pode verificar se a interação é um menu:
*   `i.isStringSelectMenu()`: Retorna `true` se for um menu de texto.
*   `i.values`: Um **array** contendo os valores (`value`) das opções que o usuário selecionou. Geralmente pegamos `i.values[0]` para seleção única.

**Como transformar o valor em ação:**
O `i.values[0]` retorna a string que você definiu no `.setValue('valor_x')` da opção. Você deve usar condicional (`if` ou `switch`) para decidir o que fazer.

```javascript
const valorEscolhido = i.values[0];

if (valorEscolhido === 'val_a') {
    await i.reply('Você escolheu a Opção A!');
} else if (valorEscolhido === 'val_b') {
    await i.update({ content: 'Mudou para B', components: [] });
}
```

### `awaitModalSubmit` (Para Modais)
Este não é um coletor de eventos contínuo, mas uma `Promise` que espera por uma **única** submissão de um modal.
*   `time`: Tempo que o usuário tem para preencher e enviar o modal.
*   `filter`: Garante que a submissão do modal é do usuário correto.

### Tipos de Resposta à Interação (`i`)
Dentro de um coletor (`collect`) ou após um `awaitModalSubmit`, você **DEVE** responder à interação, senão ela falhará.

1.  `i.reply({ content: '...', ephemeral: true })`: Manda uma mensagem nova visível só para quem clicou.
2.  `i.update({ content: '...', components: [] })`: Edita a mensagem original (útil para mudar botões ou texto após o clique).
3.  `i.showModal(modal)`: Abre um modal (só funciona se `i` for um botão ou menu).

## 7. Persistência (Botões que funcionam após reiniciar)

Os coletores mostrados no passo 6 são **temporários**: se o bot reiniciar, eles param de funcionar. Para criar botões "eternos" (como em sistemas de Ticket ou Registro):

1.  **Abandone o Coletor**: No comando, apenas envie a mensagem com o botão.
2.  **Evento Global (`interactionCreate`)**: A lógica do clique deve ficar no arquivo central de eventos do bot (ex: `events/interactionCreate.js`), fora do comando.
3.  **Verificação por CustomID**: O bot vai "ouvir" todas as interações do servidor e verificar se o ID bate.

```javascript
// Exemplo lógico para o arquivo events/interactionCreate.js
if (interaction.isButton()) {
    if (interaction.customId === 'meu_botao_eterno') {
        await interaction.reply('Funcionei mesmo após reiniciar!');
    }
}
```

---

## Exemplo de Uso Rápido

Para criar um botão simples:
```javascript
const meuBotao = new ButtonBuilder()
    .setCustomId('meu_id')
    .setLabel('Clique Aqui')
    .setStyle(ButtonStyle.Primary);
const linha = new ActionRowBuilder().addComponents(meuBotao);
```

## 8. Arquitetura de Sistemas (Como pensar a lógica)

Quando for criar um sistema novo (como um painel de loja, sistema de upgrades ou batalhas), nunca tente fazer tudo em um arquivo só. O Discord moderno funciona com base em **Eventos** e **Interações**. Divida seu sistema em 3 camadas lógicas:

1. **A Interface (O Gatilho):** O comando (ex: `/painel`) que apenas gera a mensagem inicial com os botões/menus. Ele não resolve a lógica, só "planta" a semente no chat.
2. **O Estado (A Memória):** Se o jogador precisa clicar em várias coisas em sequência, o bot precisa lembrar o que ele fez. Use um `Map()` temporário no código ou salve no Banco de Dados com `status: 'pendente'`.
3. **A Ação (O Evento):** O arquivo que vai "ouvir" o clique, processar o banco de dados e dar a resposta final (ex: entregar o item).

---

## 9. Tipos de Listeners (Como o bot "ouve" os cliques e reações)

Existem duas formas de capturar cliques de botões, seleções de menus ou reações: **Temporários (Sessões)** e **Eternos (Globais)**. A escolha errada aqui é o que faz sistemas quebrarem quando o bot reinicia.

### 9.1. Listeners Temporários (O Collector)
Usado para ações rápidas que **devem morrer** se o bot reiniciar ou o tempo acabar. 
* **Ideal para:** Batalhas de RPG, confirmação de compra rápida (Sim/Não), paginação de `/lore`.
* **Como funciona:** O código fica preso dentro do próprio comando que o gerou.
* **Exemplo:**
    ```javascript
    // Dentro do comando /batalha
    const collector = interaction.channel.createMessageComponentCollector({ time: 60000 }); // 1 minuto
    
    collector.on('collect', async i => {
        if (i.customId === 'atacar') await i.reply('Você atacou!');
    });
    ```

### 9.2. Listeners Eternos para Interações (O "Porteiro")
Usado para painéis fixos que ficam no canal (ex: Registro de Aparência, Criação de Ticket, Painel de Loja). O bot pode reiniciar 100 vezes, e o botão continuará funcionando.
* **Ideal para:** Sistemas base do servidor.
* **Como funciona:** Você **não** usa Collectors. O comando gera o botão (ex: `customId: 'abrir_ticket'`) e você vai no arquivo principal de eventos do seu bot (ex: `events/interactionCreate.js` ou num arquivo separado como `events/lojaInteraction.js`).
* **A Lógica do Porteiro:** O `interactionCreate` ouve TUDO que acontece no servidor. Você só precisa colocar um crachá de identificação (`customId`).
    ```javascript
    // Em events/interactionCreate.js (ou lojaInteraction.js)
    module.exports = {
        name: 'interactionCreate',
        async execute(interaction, client) {
            if (interaction.isButton() && interaction.customId === 'abrir_ticket') {
                // Não importa quando a mensagem foi criada, o bot sempre cai aqui!
                await interaction.reply({ content: 'Seu ticket foi aberto!', ephemeral: true });
            }
        }
    }
    ```

### 9.3. Listeners Eternos para Reações (O Segredo dos Partials)
Fazer um listener eterno de **reações** (ex: clicar no emoji 📑 numa mensagem de 1 ano atrás para favoritar uma lore) é o que mais confunde desenvolvedores.
Se o bot reiniciar, ele **limpa a memória RAM** e "esquece" todas as mensagens antigas. Se alguém reagir a uma mensagem esquecida, o evento padrão não dispara.

* **A Solução:** Você precisa usar o evento `messageReactionAdd` e forçar o bot a "baixar" (fetch) a mensagem esquecida antes de rodar o código.
* **Exemplo:**
    ```javascript
    // Em events/messageReactionAdd.js
    module.exports = {
        name: 'messageReactionAdd',
        async execute(reaction, user, client) {
            if (user.bot) return;

            // O PULO DO GATO: Se a mensagem é velha (partial), force o bot a buscar ela no Discord
            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch (error) {
                    console.error('A mensagem foi deletada ou não pôde ser buscada.', error);
                    return;
                }
            }

            // Agora você pode fazer a lógica normalmente!
            if (reaction.emoji.name === '📑') {
                const lore = reaction.message.content;
                // Salvar lore no banco de dados para o usuário, etc...
                user.send('Você favoritou essa lore!');
            }
        }
    }
    ```

---

## 10. Guia de Adaptação (Como conectar sistemas no seu Bot)

Sempre que você tiver uma ideia mirabolante ou pegar um código solto na internet, siga este checklist para adaptá-lo à estrutura de *Handlers* (pasta `commands` e `events`):

1. **Onde isso nasce?** * É um comando digitado? Crie um arquivo em `commands/`. O único papel desse arquivo é montar a interface (Embeds e Components) e enviar no chat.
2. **Isso gera um botão ou modal importante?** * Olhe o `customId` que você deu a ele. Vá para a sua pasta `events/`.
   * Se for um sistema grande (como Fichas), crie um arquivo novo lá (ex: `events/fichaInteraction.js`).
   * Adicione o ouvinte (`if (interaction.customId === '...')`) e desenvolva a lógica de negócio lá (checar banco de dados, calcular dano, dar itens).
3. **Precisa lembrar de dados entre vários modais?**
   * Crie uma variável `const cache = new Map();` no topo do seu arquivo de evento. Salve os dados com o ID do jogador (`cache.set(interaction.user.id, { dados })`). Ao terminar o fluxo final, salve no MongoDB e limpe a RAM (`cache.delete(...)`).
4. **Isso roda sozinho com o tempo?**
   * Não é comando nem interação. Crie um arquivo na pasta de utilitários (ex: `api/cron/`) e use `setInterval` atrelado ao `clientReady` para fazer o bot checar o banco de dados a cada X horas.

   ## API de Contador (`/api/contador.js`)

A API de contador fornece funções para criar e gerenciar uma mensagem de contagem regressiva visual no Discord. É flexível e pode ser instanciada em qualquer comando onde o usuário tenha um tempo limite para executar uma ação.

### Funções

#### `iniciarContador(tempoRestante, sujeito, msgAlvo)`

Inicia uma contagem regressiva e envia a mensagem no chat.

- **Parâmetros:**
  - `tempoRestante` (Number): O tempo em segundos para a contagem.
  - `sujeito` (String): A ação que o usuário deve realizar (ex: "enviar a aparência"). Será exibido na mensagem do contador.
  - `msgAlvo` (Message | Channel): O alvo onde o contador será criado. Se for um objeto de mensagem, usará `.reply()`. Se for um canal, usará `.send()`.

- **Retorna:** `Promise<Object>`
  - `intervalo`: O identificador do timer para a contagem.
  - `contador`: O objeto da mensagem no Discord que está sendo editada a cada segundo.

#### `pararContador(m, intervalo, contador)`

Para uma contagem regressiva em andamento, edita a mensagem avisando do sucesso e limpa o timer.

- **Parâmetros:**
  - `m` (any): O valor a ser retornado ao finalizar (normalmente a string ou a própria mensagem coletada).
  - `intervalo` (Number): O timer retornado por `iniciarContador`.
  - `contador` (Message): A mensagem do contador retornada por `iniciarContador`.

- **Retorna:** `Promise<any>` - Retorna a mesma variável passada no parâmetro `m`.

### Exemplo de Uso

```javascript
const { iniciarContador, pararContador } = require('../../api/contador.js');

async function executarExemplo(interacao) {
    let intervaloTemporizador;
    let mensagemContador;

    const resultadoInicializacao = await iniciarContador(
        30,
        "enviar sua confirmação",
        interacao.channel
    );
    
    intervaloTemporizador = resultadoInicializacao.intervalo;
    mensagemContador = resultadoInicializacao.contador;

    const filtroAutor = (mensagem) => mensagem.author.id === interacao.user.id;
    
    const coletorMensagens = interacao.channel.createMessageCollector({
        filter: filtroAutor,
        time: 30000,
        max: 1,
    });

    coletorMensagens.on("collect", async (mensagemColetada) => {
        const conteudoSalvo = await pararContador(
            mensagemColetada.content, 
            intervaloTemporizador, 
            mensagemContador
        );
        
        await mensagemColetada.delete().catch(() => {});
        await interacao.channel.send(`Você confirmou com: ${conteudoSalvo}`);
    });
}
