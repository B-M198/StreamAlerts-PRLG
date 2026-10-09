const Discord = require('discord.js');
const client = new Discord.Client();
var CronJob = require('cron').CronJob;
const fs = require('fs')

const Stream = require("./modules/getStreams.js")
const Auth = require("./modules/auth.js")
const Channel = require("./modules/channelData.js")
const config = require('./config.json')
let authToken = null;

//ready
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    //update the authorization key on startup
    UpdateAuthConfig()
});

//function that will run the checks
var Check = new CronJob(config.cron,async function () {
    if (!authToken) return;   // todavía no hay token
    const tempData = JSON.parse(fs.readFileSync('./config.json'))

    await Promise.all(tempData.channels.map(async function (chan, i) {
        if (!chan.ChannelName) return;
        
        let StreamData = await Stream.getData(chan.ChannelName, process.env.TWTCLI, authToken);
        if (!StreamData || !StreamData.data) {
            console.error('Error de Twitch:', StreamData);
            return;
        }
        if (StreamData.data.length == 0) return

        StreamData = StreamData.data[0]

        //get the channel data for the thumbnail image
        const ChannelData = await Channel.getData(chan.ChannelName, process.env.TWTCLI, authToken)
        if (!ChannelData) return;

        //structure for the embed
        var SendEmbed = {
            "title": `🔴 ${StreamData.user_name} está en directo desde la prisión!`,
            "description": StreamData.title,
            "url": `https://www.twitch.tv/${StreamData.user_login}`,
            "color": 6570404,
            "fields": [
                {
                    "name": "Jugando a:",
                    "value": StreamData.game_name,
                    "inline": true
                },
                {
                    "name": "Espectadores:",
                    "value": StreamData.viewer_count,
                    "inline": true
                },
                {
                    "name": "Twitch:",
                    "value": `[Entra al directo](https://www.twitch.tv/${StreamData.user_login})`
                }
            ],
            "footer": {
                "text": StreamData.started_at
            },
            "image": {
                "url": `https://static-cdn.jtvnw.net/previews-ttv/live_user_${StreamData.user_login}-640x360.jpg?cacheBypass=${(Math.random()).toString()}`
            },
            "thumbnail": {
                "url": `${ChannelData.thumbnail_url}`
            }
        }

        //get the assigned channel
        const sendChannel = client.guilds.cache.get(config.DiscordServerId).channels.cache.get(config.channelID)

        if (chan.twitch_stream_id == StreamData.id) {
            sendChannel.messages.fetch(chan.discord_message_id).then(msg => {
                //update the title, game, viewer_count and the thumbnail
                msg.edit({ embed: SendEmbed })
            });
        } else {
            //this is the message when a streamer goes live. It will tag the assigned role
            await sendChannel.send({ embed: SendEmbed }).then(msg => {
                const channelObj = tempData.channels[i]
                
                channelObj.discord_message_id = msg.id
                channelObj.twitch_stream_id = StreamData.id
                
                if(config.roleID){
                    sendChannel.send(`<@&${config.roleID}>`)
                }
            })
        }
        //save config with new data
    }))
    fs.writeFileSync('./config.json', JSON.stringify(tempData))
});

//update the authorization key every hour
var updateAuth = new CronJob('0 * * * *', async function () {
    UpdateAuthConfig()
});

//get a new authorization key and update the config
async function UpdateAuthConfig(){
    const authKey = await Auth.getKey(process.env.TWTCLI, process.env.TWTSEC);
    if (!authKey) {
        console.error('No se pudo obtener el token de Twitch, revisa TWTCLI y TWTSEC');
        return;
    }
    authToken = authKey;
}

//start the timers
updateAuth.start()
Check.start();

//login
client.login(process.env.DSCTKN);
