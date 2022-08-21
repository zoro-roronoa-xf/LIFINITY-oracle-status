import * as anchor from '@project-serum/anchor';
import { Pyth } from './Pyth'
import { lineNotify } from './LineNotify'
import { Program, Provider } from '@project-serum/anchor';
import { PublicKey, Connection, Keypair, ConfirmOptions, Transaction } from '@solana/web3.js';
 
const ParamOracleUpdate = 0.0018
const ParamStopTime = 10

const config_SOLUSDC = Keypair.fromSecretKey(new Uint8Array([]));
const config_SOLUSDT = Keypair.fromSecretKey(new Uint8Array([]));
const config_SOLUXD = Keypair.fromSecretKey(new Uint8Array([]));

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

    let amm_SOLUSDC = new PublicKey("amgK1WE8Cvae4mVdj4AhXSsknWsjaGgo1coYicasBnM");
    let authority_SOLUSDC = new PublicKey("HKJ6D9gssWAY8Zpkaf9MK3W8UEeuw4AHTMea9DFX68ip");

    let amm_SOLUSDT = new PublicKey("2x8Bmv9wj2a4LxADBWKiLyGRgAosr8yJXuZyvS8adirK");
    let authority_SOLUSDT = new PublicKey("Efnr2xpnC5nMsxpX3NtqWvDzrPBYp6wVAJUxUf4kv9g3");

    let amm_SOLUXD = new PublicKey("GjnY1NbZafYu6VSK2ELh5NRZs7udGAUR2KoAB7pYxJak");
    let authority_SOLUXD = new PublicKey("8W6j7V2XRv7Y9okzRDH2mYVaNRQn5oF5BS5ca6og5cB4");

    const oracleStatus = new anchor.BN(status)
    
    const tx = new Transaction();
    
    try{
        tx.add(program.instruction.oracleStatusUpdate(
            oracleStatus,
            {
                accounts: {
                    amm: amm_SOLUSDC,
                    authority: authority_SOLUSDC,
                    configAccount: config_SOLUSDC.publicKey,
                },
                instructions: [],
                signers: [config_SOLUSDC],
            }
        ));
    
        tx.add(program.instruction.oracleStatusUpdate(
            oracleStatus,
            {
                accounts: {
                    amm: amm_SOLUSDT,
                    authority: authority_SOLUSDT,
                    configAccount: config_SOLUSDT.publicKey,
                },
                instructions: [],
                signers: [config_SOLUSDT],
            }
        ));
    
        tx.add(program.instruction.oracleStatusUpdate(
            oracleStatus,
            {
                accounts: {
                    amm: amm_SOLUXD,
                    authority: authority_SOLUXD,
                    configAccount: config_SOLUXD.publicKey,
                },
                instructions: [],
                signers: [config_SOLUXD],
            }
        ));

        const txid = await program.provider.send(tx,[config_SOLUSDC,config_SOLUSDT,config_SOLUXD]);

        console.log(txid)
    
        // let fetchedConfigAccount = await program.account.config.fetch(config.publicKey);
        // // console.log("---CONFIG ACCOUNT---")
        // console.log("oracleStatus:",fetchedConfigAccount.oracleStatus.toNumber());

        return 0

    }catch(e){
        console.log(e)
        lineNotify("Oracle Update Error" + String(e));
        return -1
    }
}

function websocktInit(pyth: Pyth){

    console.log("websocket Start")

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

    ws.onclose = function (  ) {
        console.log('-- ws close');
        pyth.stop()
        websocktInit(pyth);
    };

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
                                if(dateNow.getUTCHours() === 1){
                                    ws.onclose()
                                }
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