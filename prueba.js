

const dotenv = require("dotenv").config();
const qrcode = require('qrcode-terminal');
const fs = require('fs');// https://nodejs.org/api/fs.html
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');// https://docs.wwebjs.dev/Chat.html 
const {Configuration, OpenAIApi} = require("openai");// https://platform.openai.com/docs/api-reference/introduction
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');
const { exec } = require('child_process');
const { rejects } = require('assert');
const async = require('async');
const moment = require('moment');


//const {Wit, log} = require('node-wit');


async function query(data) {
	const response = await fetch(
		"https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5",
		{
			headers: { Authorization: "Bearer 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" },
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.blob();

    const buffer  = Buffer.from(await result.arrayBuffer());
    fs.writeFileSync('image.png', buffer);
    return result;
}
query({"inputs": "Astronaut riding a horse"}).then((response) => {
	
});


/*
//https://www.dolarsi.com/api/api.php?type=valoresprincipales
console.log("HOLA");

const configuration = new Configuration({
    apiKey : process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


async function open(){
    let ans = await axios.get('https://api.openai.com/v1/models',{
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        }
    }
    );

    console.log(ans.data);

}
open();
 async function wordApi(word){
    console.log(moment('2019-11-03T05:00:00.000Z').utc().format('MM/DD/YYYY')) // 11/3/2019


    let ans = await axios.get('https://mercados.ambito.com/dolar/"+tipo+"/variacion');
    console.log(ans.data.compra);

    let ans2 =  await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    console.log(ans2.data[1].compra);
    //console.log(ans);
    
} */
