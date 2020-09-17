
var infura_key = '9fd26419086848afa2d9136effd73f9c';
var infura_mainnet_url = 'https://mainnet.infura.io/v3/'+infura_key;
var infura_goerli_url = 'https://goerli.infura.io/v3/'+infura_key;



if(ethereum!== 'undefined'&& ethereum.chainId=='0x5'){
	var web3 = new Web3(new Web3.providers.HttpProvider(infura_goerli_url));
}
else{
	var web3 = new Web3(new Web3.providers.HttpProvider(infura_mainnet_url));
}

var account;

var connectMetamask = async function(){
	
	
	if (typeof window.ethereum == 'undefined' || !ethereum.isMetaMask) {
		
		if (/Mobi|Android/i.test(navigator.userAgent)) {
			Swal.fire(
			  '',
			  'Buka website ini dari aplikasi MetaMask di HP.<br /><br />Belum memiliki MetaMask? Silakan unduh di: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
			  'info'
			)
			return;
		}
		
		Swal.fire(
		  'Error',
		  'Untuk menggunakan website ini Anda perlu memiliki MetaMask pada browser Anda.<br /><br />Silakan unduh MetaMask di: <a href="https://metamask.io/download.html" target="_blank">https://metamask.io/download.html</a>.',
		  'error'
		)
		return;
	}
	
	var accounts = await ethereum.request({ method: 'eth_requestAccounts' });
	account = accounts[0];
	
	
	const eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	
	web3 = new Web3(ethereum);
	
	if(!change_environment(eth_chainId)){
		console.log('eth_chainId', eth_chainId);
		return;
	}
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
}

ethereum.on('accountsChanged', async (accounts) => {
	account = accounts[0];
	
	web3 = new Web3(ethereum);
	
	$('#btn_connect_metamask').html('Connected<span>: '+account.substring(0, 6)+'..'+account.substring(account.length-4, account.length)+'</span>');
	
	eth_chainId = await ethereum.request({ method: 'eth_chainId' });
	change_environment(eth_chainId);
});

ethereum.on('chainChanged', async (chainId) => {
	
	change_environment(chainId);
});

$(function(){
	if(ethereum!== 'undefined'){
		connectMetamask();
	}
});