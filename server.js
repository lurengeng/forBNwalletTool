const express = require('express');
const Web3 = require('web3');
const cors = require('cors');
const path = require('path');
const ethUtil = require('ethereumjs-util');

const app = express();
const port = process.env.PORT || 3000;

// 配置中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 配置Web3
// 注意：这里需要替换为实际的Merlin链RPC节点地址
const web3 = new Web3('https://merlin-rpc-endpoint');

// 从签名恢复公钥
function recoverPublicKey(message, signature) {
    const messageHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(message));
    const signatureParams = ethUtil.fromRpcSig(signature);
    const publicKey = ethUtil.ecrecover(
        messageHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s
    );
    return ethUtil.bufferToHex(publicKey);
}

// 验证签名
function verifySignature(message, signature, address) {
    try {
        const publicKey = recoverPublicKey(message, signature);
        const recoveredAddress = '0x' + ethUtil.publicToAddress(ethUtil.toBuffer(publicKey)).toString('hex');
        return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
        console.error('验证签名失败:', error);
        return false;
    }
}

// 广播交易接口
app.post('/broadcast', async (req, res) => {
    try {
        const { transaction, signature, txHash } = req.body;

        // 验证交易数据
        if (!transaction || !signature || !txHash) {
            throw new Error('缺少交易数据、签名或交易哈希');
        }

        // 验证签名
        const message = web3.utils.hexToUtf8(transaction.data);
        if (!verifySignature(message, signature, transaction.from)) {
            throw new Error('签名验证失败');
        }

        // 使用签名重建交易
        const signedTx = {
            ...transaction,
            v: ethUtil.fromRpcSig(signature).v,
            r: ethUtil.fromRpcSig(signature).r,
            s: ethUtil.fromRpcSig(signature).s
        };

        // 广播交易
        const receipt = await web3.eth.sendSignedTransaction(signedTx);
        
        res.json({
            success: true,
            txHash: receipt.transactionHash
        });
    } catch (error) {
        console.error('广播交易失败:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 