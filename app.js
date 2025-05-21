let web3;
let userAddress;
let currentProvider;
let currentWallet;

// 钱包类型枚举
const WalletType = {
    BINANCE: 'binance',
    METAMASK: 'metamask',
    OKX: 'okx'
};

// ERC20代币ABI
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "name",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
];

// 检查钱包是否可用
async function checkWalletAvailable(walletType) {
    switch (walletType) {
        case WalletType.BINANCE:
            return typeof window.BinanceChain !== 'undefined';
        case WalletType.METAMASK:
            return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
        case WalletType.OKX:
            return typeof window.okxwallet !== 'undefined';
        default:
            return false;
    }
}

// 获取钱包提供者
function getWalletProvider(walletType) {
    switch (walletType) {
        case WalletType.BINANCE:
            return window.BinanceChain;
        case WalletType.METAMASK:
            return window.ethereum;
        case WalletType.OKX:
            return window.okxwallet;
        default:
            throw new Error('不支持的钱包类型');
    }
}

// 连接钱包
async function connectWallet(walletType) {
    try {
        if (!await checkWalletAvailable(walletType)) {
            throw new Error(`请安装${getWalletName(walletType)}`);
        }

        // 禁用所有钱包按钮
        disableAllWalletButtons();
        
        // 获取钱包提供者
        currentProvider = getWalletProvider(walletType);
        currentWallet = walletType;
        web3 = new Web3(currentProvider);

        // 请求连接钱包
        let accounts;
        if (walletType === WalletType.OKX) {
            accounts = await currentProvider.request({ method: 'eth_requestAccounts' });
        } else {
            accounts = await currentProvider.request({ method: 'eth_requestAccounts' });
        }
        
        userAddress = accounts[0];
        
        // 更新UI
        document.getElementById('walletStatus').textContent = `已连接: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        document.getElementById(`connect${getWalletButtonId(walletType)}`).classList.add('active');
        document.getElementById('transferForm').style.display = 'block';
        
        showStatus(`${getWalletName(walletType)}连接成功！`, 'success');

        // 监听账户变化
        if (currentProvider.on) {
            currentProvider.on('accountsChanged', handleAccountsChanged);
            currentProvider.on('chainChanged', handleChainChanged);
        }
    } catch (error) {
        showStatus(`连接钱包失败: ${error.message}`, 'error');
        enableAllWalletButtons();
    }
}

// 获取钱包名称
function getWalletName(walletType) {
    switch (walletType) {
        case WalletType.BINANCE:
            return '币安Web3钱包';
        case WalletType.METAMASK:
            return 'MetaMask';
        case WalletType.OKX:
            return 'OKX钱包';
        default:
            return '未知钱包';
    }
}

// 获取钱包按钮ID
function getWalletButtonId(walletType) {
    switch (walletType) {
        case WalletType.BINANCE:
            return 'Binance';
        case WalletType.METAMASK:
            return 'MetaMask';
        case WalletType.OKX:
            return 'OKX';
        default:
            return '';
    }
}

// 禁用所有钱包按钮
function disableAllWalletButtons() {
    document.querySelectorAll('.wallet-btn').forEach(btn => {
        btn.disabled = true;
    });
}

// 启用所有钱包按钮
function enableAllWalletButtons() {
    document.querySelectorAll('.wallet-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('active');
    });
}

// 处理账户变化
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // 用户断开连接
        userAddress = null;
        document.getElementById('walletStatus').textContent = '';
        document.getElementById('transferForm').style.display = 'none';
        enableAllWalletButtons();
        showStatus('钱包已断开连接', 'error');
    } else if (accounts[0] !== userAddress) {
        // 切换账户
        userAddress = accounts[0];
        document.getElementById('walletStatus').textContent = `已连接: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        showStatus('已切换到新账户', 'success');
    }
}

// 处理链变化
function handleChainChanged(chainId) {
    showStatus('检测到网络变化，请刷新页面', 'error');
    window.location.reload();
}

// 显示状态信息
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = type;
}

// 获取当前网络信息
async function getNetworkInfo() {
    try {
        const chainId = await currentProvider.request({ method: 'eth_chainId' });
        const networkVersion = await currentProvider.request({ method: 'net_version' });
        return { chainId, networkVersion };
    } catch (error) {
        console.error('获取网络信息失败:', error);
        return null;
    }
}

// 验证合约地址
async function validateContractAddress(address) {
    try {
        const code = await web3.eth.getCode(address);
        return code !== '0x' && code !== '0x0';
    } catch (error) {
        console.error('验证合约地址失败:', error);
        return false;
    }
}

// 将金额转换为代币的最小单位
function convertToTokenAmount(amount, decimals) {
    // 将输入的数字转换为字符串，避免JavaScript浮点数精度问题
    const amountStr = amount.toString();
    
    // 检查是否包含小数点
    if (amountStr.includes('.')) {
        const [integerPart, decimalPart] = amountStr.split('.');
        // 确保小数部分长度不超过decimals
        const paddedDecimal = decimalPart.padEnd(decimals, '0').slice(0, decimals);
        // 组合整数和小数部分
        return integerPart + paddedDecimal;
    } else {
        // 如果是整数，直接添加decimals个0
        return amountStr + '0'.repeat(decimals);
    }
}

// 查询代币余额
async function checkTokenBalance() {
    if (!currentProvider) {
        showStatus('请先连接钱包', 'error');
        return;
    }

    const tokenAddress = document.getElementById('tokenAddress').value;
    const balanceButton = document.getElementById('checkBalance');
    
    try {
        balanceButton.disabled = true;
        showStatus('正在查询余额...', 'success');

        // 获取并显示网络信息
        const networkInfo = await getNetworkInfo();
        console.log('当前网络信息:', networkInfo);

        // 验证合约地址
        const isValidContract = await validateContractAddress(tokenAddress);
        if (!isValidContract) {
            throw new Error('无效的代币合约地址');
        }

        // 创建合约实例
        const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
        
        // 获取代币信息
        let tokenInfo = {};
        try {
            tokenInfo = {
                name: await tokenContract.methods.name().call(),
                symbol: await tokenContract.methods.symbol().call(),
                decimals: await tokenContract.methods.decimals().call()
            };
            console.log('代币信息:', tokenInfo);
        } catch (error) {
            console.warn('获取代币信息失败:', error);
            tokenInfo.decimals = 18;
        }

        // 查询余额
        const balance = await tokenContract.methods.balanceOf(userAddress).call();
        console.log('原始余额:', balance);
        
        // 格式化余额显示
        const divisor = Math.pow(10, tokenInfo.decimals);
        const formattedBalance = (Number(balance) / divisor).toFixed(tokenInfo.decimals);
        const displayText = tokenInfo.symbol 
            ? `余额: ${formattedBalance} ${tokenInfo.symbol}`
            : `余额: ${formattedBalance}`;
            
        document.getElementById('tokenBalance').textContent = displayText;
        showStatus('余额查询成功！', 'success');
    } catch (error) {
        console.error('查询余额详细错误:', error);
        let errorMessage = error.message;
        
        if (error.message.includes('Out of Gas')) {
            errorMessage = '查询失败：Gas不足或合约地址无效';
        } else if (error.message.includes('invalid address')) {
            errorMessage = '无效的代币合约地址';
        } else if (error.message.includes('network')) {
            errorMessage = '网络连接错误，请检查网络设置';
        }
        
        showStatus(`查询余额失败: ${errorMessage}`, 'error');
    } finally {
        balanceButton.disabled = false;
    }
}

// 准备ERC20代币转账交易数据
async function prepareTokenTransaction(toAddress, amount, tokenAddress) {
    if (!currentProvider) {
        throw new Error('请先连接钱包');
    }

    const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    
    // 获取代币信息
    let decimals;
    try {
        decimals = await tokenContract.methods.decimals().call();
    } catch (error) {
        console.warn('获取decimals失败，使用默认值18:', error);
        decimals = 18;
    }
    
    // 将金额转换为代币的最小单位
    const amountInSmallestUnit = convertToTokenAmount(amount, decimals);
    console.log('转换后的金额:', amountInSmallestUnit);
    
    // 获取transfer方法的编码数据
    const data = tokenContract.methods.transfer(toAddress, amountInSmallestUnit).encodeABI();
    
    // 获取nonce和gasPrice
    const [nonce, gasPrice] = await Promise.all([
        currentProvider.request({ 
            method: 'eth_getTransactionCount',
            params: [userAddress, 'latest']
        }),
        currentProvider.request({
            method: 'eth_gasPrice'
        })
    ]);

    // 构建交易对象
    const transaction = {
        from: userAddress,
        to: tokenAddress,
        value: '0x0',
        data: data,
        gas: '0x' + (21000).toString(16), // 使用固定gas限制
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: '4200' // Merlin链的chainId
    };

    // 生成交易哈希
    const txHash = web3.utils.sha3(JSON.stringify(transaction));
    console.log('交易哈希:', txHash);

    return {
        transaction,
        txHash
    };
}

// 处理转账
async function handleTransfer(event) {
    event.preventDefault();
    
    if (!currentProvider) {
        showStatus('请先连接钱包', 'error');
        return;
    }

    const tokenAddress = document.getElementById('tokenAddress').value;
    const toAddress = document.getElementById('toAddress').value;
    const amount = document.getElementById('amount').value;
    const transferButton = document.getElementById('transferButton');
    
    try {
        transferButton.disabled = true;
        showStatus('正在准备交易...', 'success');

        // 准备交易数据
        const { transaction, txHash } = await prepareTokenTransaction(toAddress, amount, tokenAddress);
        
        // 构建签名消息
        const message = `请签名以下交易：\n\n接收地址：${toAddress}\n转账金额：${amount}\n代币合约：${tokenAddress}\n\n交易哈希：${txHash}`;
        const messageHex = web3.utils.utf8ToHex(message);
        
        // 请求签名
        let signature;
        try {
            signature = await currentProvider.request({
                method: 'personal_sign',
                params: [messageHex, userAddress]
            });
            console.log('签名结果:', signature);
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('用户拒绝了签名请求');
            }
            throw error;
        }

        // 发送签名到后端
        const response = await fetch('/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transaction: transaction,
                signature: signature,
                txHash: txHash,
                message: message // 添加原始消息用于验证
            })
        });

        const result = await response.json();
        
        if (result.success) {
            showStatus(`交易已广播！交易哈希: ${result.txHash}`, 'success');
            await checkTokenBalance();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('转账失败:', error);
        let errorMessage = error.message;
        if (error.code === 4001) {
            errorMessage = '用户取消了签名';
        }
        showStatus(`转账失败: ${errorMessage}`, 'error');
    } finally {
        transferButton.disabled = false;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 添加钱包连接事件监听
    document.getElementById('connectBinance').addEventListener('click', () => connectWallet(WalletType.BINANCE));
    document.getElementById('connectMetaMask').addEventListener('click', () => connectWallet(WalletType.METAMASK));
    document.getElementById('connectOKX').addEventListener('click', () => connectWallet(WalletType.OKX));
    
    // 添加表单提交事件监听
    document.getElementById('transferForm').addEventListener('submit', handleTransfer);
    document.getElementById('checkBalance').addEventListener('click', checkTokenBalance);
}); 