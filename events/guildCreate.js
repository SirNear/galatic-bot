module.exports = class GuildCreate {
  constructor(client) {
    this.client = client
  }

  async run(guild) {
    
    const server = await this.client.database.Guilds.findById(guild.id)
    
    if (!server) {
      this.client.database.Guilds({
          _id: guild.id
      }).save().then(msg =>{
          console.log('Deu certo bro')
      })
    }
    
    
  }

}
