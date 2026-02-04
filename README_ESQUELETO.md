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

## 6. Coletores (`createMessageComponentCollector`)
É o "ouvido" do bot que fica esperando cliques na mensagem enviada.
*   `filter`: (Opcional) Define quem pode interagir (ex: `i => i.user.id === interaction.user.id`).
*   `time`: Tempo em milissegundos que o bot vai esperar.
*   **Eventos**:
    *   `.on('collect', async i => { ... })`: Dispara a cada clique.
    *   `.on('end', () => { ... })`: Dispara quando o tempo acaba.

### Tipos de Resposta à Interação (`i`)
Dentro do coletor, você **DEVE** responder à interação, senão ela dá "A interação falhou".

1.  `i.reply({ content: '...', ephemeral: true })`: Manda uma mensagem nova visível só para quem clicou.
2.  `i.update({ content: '...', components: [] })`: Edita a mensagem original (útil para mudar botões ou texto após o clique).
3.  `i.showModal(modal)`: Abre um modal (só funciona se `i` for um botão ou menu).

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