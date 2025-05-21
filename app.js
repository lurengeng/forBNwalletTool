let provider;
let signer;
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
    "function balanceOf(address owner) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
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
        
        // 创建ethers provider和signer
        provider = new ethers.BrowserProvider(currentProvider);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
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
    try {
        return ethers.parseUnits(amount.toString(), decimals);
    } catch (error) {
        throw new Error('金额格式无效');
    }
}

// 查询代币余额
async function checkTokenBalance() {
    if (!signer) {
        showStatus('请先连接钱包', 'error');
        return;
    }

    const tokenAddress = document.getElementById('tokenAddress').value;
    const balanceButton = document.getElementById('checkBalance');
    
    try {
        balanceButton.disabled = true;
        showStatus('正在查询余额...', 'success');

        // 验证合约地址
        if (!ethers.isAddress(tokenAddress)) {
            throw new Error('无效的代币合约地址');
        }

        // 创建合约实例
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // 获取代币信息
        let tokenInfo = {};
        try {
            tokenInfo = {
                name: await tokenContract.name(),
                symbol: await tokenContract.symbol(),
                decimals: await tokenContract.decimals()
            };
            console.log('代币信息:', tokenInfo);
        } catch (error) {
            console.warn('获取代币信息失败:', error);
            tokenInfo.decimals = 18;
        }

        // 查询余额
        const balance = await tokenContract.balanceOf(userAddress);
        console.log('原始余额:', balance.toString());
        
        // 格式化余额显示
        const formattedBalance = ethers.formatUnits(balance, tokenInfo.decimals);
        const displayText = tokenInfo.symbol 
            ? `余额: ${formattedBalance} ${tokenInfo.symbol}`
            : `余额: ${formattedBalance}`;
            
        document.getElementById('tokenBalance').textContent = displayText;
        showStatus('余额查询成功！', 'success');
    } catch (error) {
        console.error('查询余额详细错误:', error);
        let errorMessage = error.message;
        
        if (error.message.includes('insufficient funds')) {
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
    if (!signer) {
        throw new Error('请先连接钱包');
    }

    if (!ethers.isAddress(toAddress) || !ethers.isAddress(tokenAddress)) {
        throw new Error('无效的地址');
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    
    // 获取代币信息
    let decimals;
    try {
        decimals = await tokenContract.decimals();
    } catch (error) {
        console.warn('获取decimals失败，使用默认值18:', error);
        decimals = 18;
    }
    
    // 将金额转换为代币的最小单位
    const amountInSmallestUnit = convertToTokenAmount(amount, decimals);
    console.log('转换后的金额:', amountInSmallestUnit.toString());
    
    // 获取当前nonce和gasPrice
    const [nonce, feeData] = await Promise.all([
        signer.getNonce(),
        provider.getFeeData()
    ]);

    // 构建交易对象
    const transaction = {
        from: userAddress,
        to: tokenAddress,
        data: tokenContract.interface.encodeFunctionData("transfer", [toAddress, amountInSmallestUnit]),
        gasLimit: 21000n,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        nonce: nonce,
        chainId: 4200n // Merlin链的chainId
    };

    // 生成交易哈希
    const txHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(transaction)));
    console.log('交易哈希:', txHash);

    return {
        transaction,
        txHash
    };
}

// 检查RPC节点连接
async function checkRPCConnection() {
    try {
        // 首先检查后端服务器是否可用
        const response = await fetch('/check-rpc', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.connected) {
            throw new Error(data.error || '无法连接到Merlin链RPC节点');
        }

        // 如果后端服务器正常，再检查RPC节点连接
        if (provider) {
            try {
                // 尝试获取最新的区块号
                await provider.getBlockNumber();
                // 尝试获取网络信息
                const network = await provider.getNetwork();
                console.log('当前网络信息:', {
                    chainId: network.chainId,
                    name: network.name
                });
                return true;
            } catch (error) {
                console.error('RPC节点连接检查失败:', error);
                throw new Error('RPC节点连接不稳定，请稍后重试');
            }
        }

        return true;
    } catch (error) {
        console.error('RPC节点检查失败:', error);
        let errorMessage = '无法连接到服务器';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = '无法连接到后端服务器，请确保服务器已启动';
        } else if (error.message.includes('RPC节点连接不稳定')) {
            errorMessage = error.message;
        } else if (error.message.includes('服务器响应错误')) {
            errorMessage = '后端服务器响应异常，请稍后重试';
        }
        
        showStatus(errorMessage, 'error');
        return false;
    }
}

// 处理转账
async function handleTransfer(event) {
    event.preventDefault();
    
    if (!signer) {
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
        
        // 请求签名
        let signature;
        try {
            signature = await signer.signMessage(message);
            console.log('签名结果:', signature);
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('用户拒绝了签名请求');
            }
            throw error;
        }

        // 发送签名到后端
        let response;
        try {
            response = await fetch('/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transaction: transaction,
                    signature: signature,
                    txHash: txHash,
                    message: message
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('服务器响应错误:', errorText);
                throw new Error(`服务器响应错误: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showStatus(`交易已广播！交易哈希: ${result.txHash}`, 'success');
                await checkTokenBalance();
            } else {
                throw new Error(result.error || '交易广播失败');
            }
        } catch (error) {
            if (error.name === 'SyntaxError') {
                console.error('服务器返回了无效的JSON:', error);
                throw new Error('服务器返回了无效的数据，请确保服务器正常运行');
            }
            throw error;
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
document.addEventListener('DOMContentLoaded', async () => {
    // 添加钱包连接事件监听
    document.getElementById('connectBinance').addEventListener('click', () => connectWallet(WalletType.BINANCE));
    document.getElementById('connectMetaMask').addEventListener('click', () => connectWallet(WalletType.METAMASK));
    document.getElementById('connectOKX').addEventListener('click', () => connectWallet(WalletType.OKX));
    
    // 添加表单提交事件监听
    document.getElementById('transferForm').addEventListener('submit', handleTransfer);
    document.getElementById('checkBalance').addEventListener('click', checkTokenBalance);

    // 检查服务器连接
    try {
        await checkRPCConnection();
    } catch (error) {
        console.error('初始服务器检查失败:', error);
    }
}); 