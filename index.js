const MenuDocsClient = require('./structures/MenuDocsClient')
const config = require('./config.json')



const client = new MenuDocsClient(config);

client.start().then(() => {  
   console.log("Acordei!!")
})
