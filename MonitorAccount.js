const Web3 = require('web3');
require('dotenv').config();
class MonitorAccount {
    web3;
    web3ws;
    accounts = [];
    subscription;

    constructor(projectId, accounts) {
        this.web3ws = new Web3(new Web3.providers.WebsocketProvider('wss://rinkeby.infura.io/ws/v3/' + projectId));
        this.web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/' + projectId));
        accounts.forEach(element => {
            this.accounts.push(element.toLowerCase())
        });
    }

    subscribe(topic) {
        this.subscription = this.web3ws.eth.subscribe(topic, (err, res) => {
            if (err) console.error(err);
        });
    }

    async watchTransactions() {
        console.log('Watching all transactions...');
        this.subscription.on('data', (txHash) => {
            setTimeout(async () => {
                try {
                    let tx = await this.web3.eth.getTransaction(txHash);
                    if (tx != null && tx.to != null) {
                        this.accounts.forEach(account =>{
                            if (account==tx.to.toLowerCase()) {
                                console.log({from: tx.from,to: tx.to, value: this.web3.utils.fromWei(tx.value, 'ether'), timestamp: new Date()});
                                this.transferEthersToColdWallet(tx.to);
                            }
                        })
        
                    }
                } catch (err) {
                    console.error(err);
                }
            }, 60000)
        });
    }

    async transferEthersToColdWallet(from) {
        let balance = await this.web3.eth.getBalance(from);
        let trx = {
            from: from,
            to: process.env.COLD_WALLET,
            value: balance
        }
        let gas = await this.web3.eth.estimateGas(trx);
        let gasPrice = await this.web3.eth.getGasPrice();
        console.log("Estimated GasFee:"+gas*gasPrice);
        let gasFee = 2*gas*gasPrice;
       let value = this.web3.utils.toBN(balance).sub(this.web3.utils.toBN(gasFee)).toString();
       trx.value = value;
       trx.gas = gas;
       const signedTx = await this.web3.eth.accounts.signTransaction(trx, process.env.PRIVATE_KEY);
       this.web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, hash) {
        if (!error) {
          console.log("The hash of your transaction is: ", hash);
        } else {
          console.log("Something went wrong while submitting your transaction:", error)
        }
       });
    }
}

let txChecker = new MonitorAccount(process.env.INFURA_ID, ['0x1DC61850cD03f6B35CBe0f1B2fAA0E328d0F6A81','0x2Af04de0716A5dc9a05B439Af8B6f9dF1e989487']);
txChecker.subscribe('pendingTransactions');
txChecker.watchTransactions();