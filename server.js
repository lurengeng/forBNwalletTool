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
const MERLIN_RPC = 'https://rpc.merlinchain.io'; // 替换为实际的RPC节点地址
const web3 = new Web3(MERLIN_RPC);

// 检查RPC节点连接
async function checkRPCConnection() {
    try {
        await web3.eth.getBlockNumber();
        return true;
    } catch (error) {
        console.error('RPC节点连接失败:', error);
        return false;
    }
}

// RPC节点检查接口
app.get('/check-rpc', async (req, res) => {
    try {
        const connected = await checkRPCConnection();
        res.json({ connected });
    } catch (error) {
        console.error('RPC检查失败:', error);
        res.status(500).json({ 
            connected: false, 
            error: '无法连接到RPC节点' 
        });
    }
});

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

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        error: err.message || '服务器内部错误'
    });
});

// 广播交易接口
app.post('/broadcast', async (req, res) => {
    try {
        // 检查RPC连接
        if (!await checkRPCConnection()) {
            throw new Error('无法连接到Merlin链RPC节点');
        }

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
            error: error.message || '交易广播失败'
        });
    }
});

// 启动服务器
app.listen(port, async () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    
    // 检查RPC连接
    try {
        const connected = await checkRPCConnection();
        if (connected) {
            console.log('成功连接到Merlin链RPC节点');
        } else {
            console.error('警告: 无法连接到Merlin链RPC节点');
        }
    } catch (error) {
        console.error('RPC节点检查失败:', error);
    }
}); 