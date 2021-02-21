const Event = require('../structures/Event');

module.exports = class extends Event {

	constructor(...args) {
		super(...args, {
			once: true
		});
	}

	run() {
		console.log([
			`Logado em ${this.client.user.tag}`,
			`${this.client.commands.size} comandos carregados!`,
			`${this.client.events.size} eventos carregados!`
		].join('\n'));
	}
  
   let status = [
    {name:`Meu poder a ${client.users.size} pessoas em todo o Galatic Coffe!`, type: 'STREAMING', url: 'https://twitch.tv/galatic'},
    {name:'Pó de café na pia', type: 'PLAYING'},
    {name:`Alegria para os meus filhos`, type: 'STREAMING', url: 'https://twitch.tv/galatic'},
    {name:`Observando ${client.channels.size} mundos diferentes!`, type: 'PLAYING'}
   
  ];
  
  
  function setStatus() {
    let altstatus = status[Math.floor(Math.random()*status.length)]
     client.user.setPresence({game: altstatus})
    }

  setStatus();
  setInterval(() => setStatus(), 7000)
})

};
