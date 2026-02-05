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