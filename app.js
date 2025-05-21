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

        const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
        const decimals = await tokenContract.methods.decimals().call();
        const balance = await tokenContract.methods.balanceOf(userAddress).call();
        
        const formattedBalance = web3.utils.fromWei(balance, 'ether');
        document.getElementById('tokenBalance').textContent = `余额: ${formattedBalance}`;
        showStatus('余额查询成功！', 'success');
    } catch (error) {
        showStatus(`查询余额失败: ${error.message}`, 'error');
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
    const decimals = await tokenContract.methods.decimals().call();
    
    // 将金额转换为代币的最小单位
    const amountInWei = web3.utils.toBN(amount).mul(web3.utils.toBN(10).pow(web3.utils.toBN(decimals)));
    
    // 获取transfer方法的编码数据
    const data = tokenContract.methods.transfer(toAddress, amountInWei.toString()).encodeABI();
    
    const nonce = await currentProvider.request({ 
        method: 'eth_getTransactionCount',
        params: [userAddress, 'latest']
    });

    const gasPrice = await currentProvider.request({
        method: 'eth_gasPrice'
    });

    // 估算gas限制
    const gasLimit = await tokenContract.methods.transfer(toAddress, amountInWei.toString())
        .estimateGas({ from: userAddress });

    return {
        from: userAddress,
        to: tokenAddress,
        value: '0x0',
        data: data,
        gas: web3.utils.toHex(Math.floor(gasLimit * 1.2)),
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: '4200' // 需要根据实际情况修改
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

        const transaction = await prepareTokenTransaction(toAddress, amount, tokenAddress);
        
        // 根据不同钱包处理签名
        let signature;
        if (currentWallet === WalletType.METAMASK) {
            // MetaMask直接发送交易
            signature = await currentProvider.request({
                method: 'eth_sendTransaction',
                params: [transaction]
            });
            showStatus(`交易已发送！交易哈希: ${signature}`, 'success');
            await checkTokenBalance();
            return;
        } else {
            // 其他钱包请求签名
            signature = await currentProvider.request({
                method: 'eth_signTransaction',
                params: [transaction]
            });

            // 发送签名到后端
            const response = await fetch('/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transaction: transaction,
                    signature: signature
                })
            });

            const result = await response.json();
            
            if (result.success) {
                showStatus(`交易已广播！交易哈希: ${result.txHash}`, 'success');
                await checkTokenBalance();
            } else {
                throw new Error(result.error);
            }
        }
    } catch (error) {
        showStatus(`转账失败: ${error.message}`, 'error');
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