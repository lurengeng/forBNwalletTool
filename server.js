const express = require('express');
const Web3 = require('web3');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 配置中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 配置Web3
// 注意：这里需要替换为实际的Merlin链RPC节点地址
const web3 = new Web3('https://merlin-rpc-endpoint');

// 广播交易接口
app.post('/broadcast', async (req, res) => {
    try {
        const { transaction, signature } = req.body;

        // 验证交易数据
        if (!transaction || !signature) {
            throw new Error('缺少交易数据或签名');
        }

        // 使用签名重建交易
        const signedTx = {
            ...transaction,
            v: signature.v,
            r: signature.r,
            s: signature.s
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