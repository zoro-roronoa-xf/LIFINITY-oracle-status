import { PythConnection, getPythProgramKeyForCluster } from '@pythnetwork/client'
import { Connection, Cluster } from "@solana/web3.js";
import { lineNotify } from './LineNotify'

export class Pyth {
    pythConnection: PythConnection | undefined
    priceSolUsd: number = 0

    init(){
        try{
            const connection = new Connection('https://ssc-dao.genesysgo.net');
            this.pythConnection = new PythConnection(connection, getPythProgramKeyForCluster('mainnet-beta' as Cluster))
            this.pythConnection.onPriceChange(this.pythCallBack.bind(this))
            if (this.pythConnection){
                this.pythConnection.start();
            }
        }catch(e){
            lineNotify("Pyth WebSocket Error" + String(e));
            this.init();
        }      
    }

    stop(){
        if (this.pythConnection){
            this.pythConnection.stop()
        }
    }

    pythCallBack(product: { symbol: any; }, price: { aggregate: any }){
        if(product.symbol === "Crypto.SOL/USD"){
            this.priceSolUsd = price.aggregate.price
        }
    }
}
