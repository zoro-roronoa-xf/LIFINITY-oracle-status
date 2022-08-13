const axios = require('axios');
const qs = require('querystring');
const BASE_URL = 'https://notify-api.line.me';
const PATH = '/api/notify';
const LINE_TOKEN = `7xwJdTHB5KQYZRQbQCtOgtGhqYdJuRTb7mZSmgyyt2Y`;
const LINE_TOKEN_2 = `yJrAgCzJUaNfAPYogujDR5zbdDVvB2eWl0dQ4Z2U4Rt`;
 
export async function lineNotify(text: string){
    lineNotifyConf1(text);
    lineNotifyConf2(text);
}

async function lineNotifyConf1(text: string){
    const config = {
        baseURL: BASE_URL,
        url: PATH,
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${LINE_TOKEN}`
        },
        data: qs.stringify({
            message: "[OracleBot]\n" + text,
        })
    };
    await axios.request(config);
}

async function lineNotifyConf2(text: string){
    const config = {
        baseURL: BASE_URL,
        url: PATH,
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${LINE_TOKEN_2}`
        },
        data: qs.stringify({
            message: "[OracleBot]\n" + text,
        })
    };
    await axios.request(config);
}
