const axios = require('axios');
const moment = require('moment');

function help(msg){
    msg.reply(`
                    *Comandos*
_____________________________________            
*summa*: resume 200 msg's del chat         
_____________________________________            
*summa [n]*: resume n msg's del chat       
_____________________________________            
*resumi [chat]*: resume msg's de chat       
_____________________________________            
*gpt [consulta]*: responde gpt     
_____________________________________            
*texto*: traduce audio a texto     
_____________________________________            
*gptaudio*: audio a gpt            
_____________________________________
*randomize*: random activity
_____________________________________
*log [n]*: muestra n msg's         
_____________________________________            
*atou [number]*: ARS to USD
_____________________________________
*utoa [number]*: USD to ARS
_____________________________________
*dolares*: dolar info
_____________________________________
*dolarB*: dolar blue info
_____________________________________
*dolaroficial*: dolar oficial info
_____________________________________
*!groupinfo*: info del grupo
_____________________________________
*!help*: muestra este mensaje
_____________________________________
                `);
}

async function dolar(){
    let dolar = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
                let dolarData = dolar.data[1];
                msg.reply(`
                *${dolarData.nombre}*
_____________________________________            
Compra: *${dolarData.compra}*         
_____________________________________            
Venta: *${dolarData.venta}*       
_____________________________________            
_Fuente: https://dolarhoy.com/_
            `);
}

function groupInfo(chat){
    msg.reply(`
                        *Group Details*
Name: ${chat.name}
Description: ${chat.description}
Created At: ${chat.createdAt.toString()}
Created By: ${chat.owner.user}
Participant count: ${chat.participants.length}
                    `
);
}

async function dolares(){
    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let dolaresData = dolares.data;
    let dolaresStr = "*CASA* : COMPRA | VENTA\n";
    dolaresStr += "_____________________________________\n";
    var date = moment(dolaresData[0].fechaActualizacion).utc().format('DD/MM/YYYY');
    for (let i = 0; i < dolaresData.length; i++) {
        const dolar = dolaresData[i];
        dolaresStr += `*${dolar.nombre}* : ${dolar.compra} | ${dolar.venta}\n`;
        dolaresStr += "_____________________________________\n";
    }
    dolaresStr += `${date} \n`;
    dolaresStr += "_Fuente: https://dolarhoy.com/_";
    return dolaresStr;
}


async function getUtoA(usd){
    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let compra = parseFloat(dolares.data[1].compra);
    let venta = parseFloat(dolares.data[1].venta);
    let dolarblue = (compra + venta) / 2;
    let usdToArs = usd * dolarblue;
    usdToArs = parseFloat(usdToArs.toFixed(2));
}
async function getAtoU(ars){
    let dolares = await axios.get('https://dolar-api-argentina.vercel.app/v1/dolares');
    let compra = parseFloat(dolares.data[1].compra);
    let venta = parseFloat(dolares.data[1].venta);
    let dolarblue = (compra + venta) / 2;
    let arsToUsd = ars / dolarblue;
    arsToUsd = parseFloat(arsToUsd.toFixed(2));
}


module.exports = {
    help,
    dolar,
    dolares,
    groupInfo,
    getUtoA,
    getAtoU
}