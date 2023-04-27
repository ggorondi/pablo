require('dotenv').config();
const fs = require('fs');// https://nodejs.org/api/fs.html
const {Configuration, OpenAIApi} = require("openai");// https://platform.openai.com/docs/api-reference/introduction
const configuration = new Configuration({
    apiKey : process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function createImageHugging(data){
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5",
            {
                headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
                method: "POST",
                body: JSON.stringify(data),
            }
	    );
        const result = await response.blob();

        const buffer  = Buffer.from(await result.arrayBuffer());
        fs.writeFileSync('image.png', buffer);
    }
    catch (err){
        console.log(err);
    }
}   



async function createImageOpenAI(prompto){
    try{
        const prompt = prompto + " "; 
        const result = await openai.createImage({
            prompt, 
            n: 1,
            size: '256x256'

        });
        const url = result.data.data[0].url;
        console.log(url);
        const img = await fetch(url);
        const blob = await img.blob();
        const buffer  = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync('image.png', buffer);
    }
    catch (err){
        console.log(err);
    }
}

function deleteFile(fileToDelete){
    fs.unlink(fileToDelete, (err) => {
        if (err) {
          console.error(err)
          return
        }
      })
}


module.exports = {
    createImageHugging,
    createImageOpenAI,
    deleteFile
}