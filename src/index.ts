import * as anchor from '@project-serum/anchor';
import { Pyth } from './Pyth'
import { lineNotify } from './LineNotify'
import { Program, Provider } from '@project-serum/anchor';
import { PublicKey, Connection, Keypair, ConfirmOptions } from '@solana/web3.js';
 
const ParamOracleUpdate = 0.0018
const ParamStopTime = 10

const config = Keypair.fromSecretKey(new Uint8Array([]));

const idl = require('../idl/lifinity_amm.json');

const programID = new PublicKey("EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S");
const network = "https://ssc-dao.genesysgo.net";

// Payer 97R4UGhdj7WqXA5AhfQqxM2CGDscJ5meFC8ZJvSoNUBs
const localProvicer = Provider.local(network);
const payerWallet = localProvicer.wallet;
const opts = {
  'commitment': "processed",
  'preflightCommitment': "processed",
  'skipPreflight': true } as ConfirmOptions;
const connection = new Connection(network, "processed");
const provider = new Provider(connection, payerWallet, opts);
const program = new Program(idl, programID, provider);

const WebSocket = require('ws');

async function updateOracle(status: number){
    console.log("update oracle:",status)

    let amm = new PublicKey("amgK1WE8Cvae4mVdj4AhXSsknWsjaGgo1coYicasBnM");
    let authority = new PublicKey("HKJ6D9gssWAY8Zpkaf9MK3W8UEeuw4AHTMea9DFX68ip");
    const oracleStatus = new anchor.BN(status)
    
    try{
        let tx_init = await program.rpc.oracleStatusUpdate(
            oracleStatus,
            {
                accounts: {
                    amm: amm,
                    authority: authority,
                    configAccount: config.publicKey,
                },
                instructions: [],
                signers: [config],
            }
        );
    
        console.log(tx_init)
    
        let fetchedConfigAccount = await program.account.config.fetch(config.publicKey);
        // console.log("---CONFIG ACCOUNT---")
        console.log("oracleStatus:",fetchedConfigAccount.oracleStatus.toNumber());

        return 0

    }catch(e){
        console.log(e)
        lineNotify("Oracle Update Error" + String(e));
        return -1
    }
}

function websocktInit(pyth: Pyth){

    let oracleStatus = 0
    let updateTime = new Date();
    let beforeLienTime = new Date();
    let update = 0
    pyth.init();

    const param1 = JSON.stringify({
        "op": "subscribe",
        "channel": "trades",
        "market": "SOL/USD"
    })

    let ws = new WebSocket("wss://ftx.com/ws");

    ws.addEventListener('open', () => {
        ws.send(param1);
    });

    ws.on('close', function incoming() {
        console.log('-- ws close');
        pyth.stop()
        websocktInit(pyth);
    });

    ws.onmessage = async function(e: any) {
        try{
            const message = JSON.parse(e.data);

            if ('channel' in message){
                if (message.channel === 'trades'){
                    if ('data' in message){
                        for (const order of message.data){

                            const price = order.price
                            const dateNow = new Date()

                            if(update === 0 && pyth.priceSolUsd != 0 && price != 0){
                                const priceDiff = (pyth.priceSolUsd / price) - 1

                                // console.log("pyth:",pyth.priceSolUsd,"ftx:",price,"priceDiff:",priceDiff)

                                if(oracleStatus === 0 && priceDiff > ParamOracleUpdate){
                                    console.log("Status 1:",priceDiff, ParamOracleUpdate)
                                    update = 1;
                                    const updateResult = await updateOracle(1);
                                    if(updateResult === 0){
                                        oracleStatus = 1
                                        updateTime = new Date();
                                        lineNotify("Oracle Status 1\n (value:" + String(Math.floor(priceDiff * 1000000)/1000000) + ")");
                                    }
                                    update = 0;
                                }else if(oracleStatus === 0 && priceDiff < ParamOracleUpdate * -1){
                                    console.log("Status 2:",priceDiff, ParamOracleUpdate)
                                    update = 1;
                                    const updateResult = await updateOracle(2);
                                    if(updateResult === 0){
                                        oracleStatus = 2
                                        updateTime = new Date();
                                        lineNotify("Oracle Status 2\n (value:" + String(Math.floor(priceDiff * 1000000)/1000000) + ")");
                                    }
                                    update = 0;
                                }else if ((oracleStatus === 1 || oracleStatus === 2) && (priceDiff < ParamOracleUpdate && priceDiff > ParamOracleUpdate * -1) && (updateTime.getTime() + (ParamStopTime * 1000) < dateNow.getTime())){
                                    ParamStopTime
                                    console.log("Status 0:",priceDiff, ParamOracleUpdate)
                                    update = 1;
                                    const updateResult = await updateOracle(0);
                                    if(updateResult === 0){
                                        lineNotify("Oracle Status 0\n (value:" + String(Math.floor(priceDiff * 1000000)/1000000) + ")");
                                        oracleStatus = 0
                                    }
                                    update = 0;
                                }
                            }

                            if(dateNow.getUTCHours() != beforeLienTime.getUTCHours()){
                                console.log("生存通知\n (OracleStatus:" + String(oracleStatus) + ")");
                                lineNotify("生存通知\n (OracleStatus:" + String(oracleStatus) + ")");
                                beforeLienTime = dateNow
                            }
                        }
                    }
                }
            }
        }catch(e){
            console.log(e)
            lineNotify("Solana WebSocket Error" + String(e));
        }
    };
}


async function main(){
    await updateOracle(0)
    console.log("Oracle Status Bot Start")
    const pyth = new Pyth();
    websocktInit(pyth);
}

main();