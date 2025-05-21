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

// 从签名恢复地址
function recoverAddress(message, signature) {
    try {
        const messageHash = ethUtil.hashPersonalMessage(ethUtil.toBuffer(message));
        const signatureParams = ethUtil.fromRpcSig(signature);
        const publicKey = ethUtil.ecrecover(
            messageHash,
            signatureParams.v,
            signatureParams.r,
            signatureParams.s
        );
        const address = ethUtil.publicToAddress(publicKey);
        return '0x' + address.toString('hex');
    } catch (error) {
        console.error('恢复地址失败:', error);
        return null;
    }
}

// 验证签名
function verifySignature(message, signature, expectedAddress) {
    const recoveredAddress = recoverAddress(message, signature);
    if (!recoveredAddress) {
        return false;
    }
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

// 广播交易接口
app.post('/broadcast', async (req, res) => {
    try {
        const { transaction, signature, txHash, message } = req.body;

        // 验证交易数据
        if (!transaction || !signature || !txHash || !message) {
            throw new Error('缺少必要的交易数据');
        }

        // 验证签名
        if (!verifySignature(message, signature, transaction.from)) {
            throw new Error('签名验证失败');
        }

        // 验证交易哈希
        const calculatedHash = web3.utils.sha3(JSON.stringify(transaction));
        if (calculatedHash !== txHash) {
            throw new Error('交易哈希验证失败');
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