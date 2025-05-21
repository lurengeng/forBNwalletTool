const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 配置中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 配置Provider
const MERLIN_RPC = 'https://rpc.merlinchain.io'; // 替换为实际的RPC节点地址
const provider = new ethers.JsonRpcProvider(MERLIN_RPC);

// 检查RPC节点连接
async function checkRPCConnection() {
    try {
        await provider.getBlockNumber();
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

// 验证签名
async function verifySignature(message, signature, expectedAddress) {
    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
        console.error('验证签名失败:', error);
        return false;
    }
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
        if (!await verifySignature(message, signature, transaction.from)) {
            throw new Error('签名验证失败');
        }

        // 验证交易哈希
        const calculatedHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(transaction)));
        if (calculatedHash !== txHash) {
            throw new Error('交易哈希验证失败');
        }

        // 使用签名重建交易
        const signedTx = {
            ...transaction,
            signature: signature
        };

        // 广播交易
        const tx = await provider.broadcastTransaction(signedTx);
        const receipt = await tx.wait();
        
        res.json({
            success: true,
            txHash: receipt.hash
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