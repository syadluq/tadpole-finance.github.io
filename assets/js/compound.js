
var formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
});

const blocksPerDay = 4 * 60 * 24;
const daysPerYear = 365;
const mentissa = 1e18;

var syncRate = function(){
	Object.values(cTokens).forEach(async function(cont, index){
	
		var supplyRatePerBlock = await cont.cToken.methods.supplyRatePerBlock().call();
		var borrowRatePerBlock = await cont.cToken.methods.borrowRatePerBlock().call();
		var supplyApy = (((Math.pow((supplyRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		var borrowApy = (((Math.pow((borrowRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		
		$(`.val_${cont.id}_apy`).html(supplyApy.toFixed(2)+'%');
		
	});
	
}

var getBalance = async function(cont, address){
			
	if(!address){
		return 0;
	}
	
	if(cont.id=='eth'){
		var balance = await web3.eth.getBalance(address);
		balance = web3.utils.fromWei(balance);
		return balance;
	}
	
	var token = new web3.eth.Contract(erc20Abi, cont.underlyingaddress);
	var balance = await token.methods.balanceOf(address).call();
	
	balance = balance / Math.pow(10, cont.underlyingDecimals);
	
	return balance;
	
}

var syncCompAccount = function(address){
			
	if(!address){
		Object.values(cTokens).forEach(function(cItem, cIndex){
			var cont = cItem;
			$(`.val_${cont.id}_earned`).html('0 '+cont.unit);			
			$(`.val_${cont.id}_balance_underlying`).html('0 '+cont.unit);
		});
		return;
	}
	
	$('.refresh-btn').addClass('mdi-spin');
	
	var url = 'https://api.compound.finance/api/v2/account?addresses[]='+address+'&'+Date.now();
	
	fetch(url)
	.then(response => response.json())
	.then(function(data) {
		var tokens = data.accounts[0].tokens;
		
		Object.values(cTokens).forEach(function(cItem, cIndex){
			var data;
			var cont = cItem;
			
			
			Object.values(tokens).forEach(function(item, index){
				if(item.address==cItem.address){
					data = item
				}
			});
			
			if(!data){
				$(`.val_${cont.id}_earned`).html('0 '+cont.unit);			
				$(`.val_${cont.id}_balance_underlying`).html('0 '+cont.unit);
				return;
			}
			compAccountValue[cont.id] = data;
			
			$(`.val_${cont.id}_earned`).html(parseFloat(data.lifetime_supply_interest_accrued.value).toFixed(8)+' '+cont.unit);			
			$(`.val_${cont.id}_balance_underlying`).html(parseFloat(data.supply_balance_underlying.value).toFixed(8)+' '+cont.unit);
			
			updatePrices();
			
			
		});
		
		$('.refresh-btn').removeClass('mdi-spin');
	})
	.catch(function(error) {
		console.log(error);
		Swal.fire(
		  'Error',
		  'Failed to connect to Compound.finance.',
		  'error'
		)
		
		$('.refresh-btn').removeClass('mdi-spin');
	});   
}

var getPrices = function(){
	
	var addresses = '';
	
	Object.values(cTokens).forEach(function(cItem, cIndex){
		addresses += cItem.index+',';
	});
	
	
	var url = 'https://api.coingecko.com/api/v3/simple/price?ids='+addresses+'&vs_currencies=idr';
	
	fetch(url)
	.then(response => response.json())
	.then(function(data) {
		
		for (const [index, item] of Object.entries(data)) {
			prices[index] = item.idr
		};
		updatePrices();
	})
	.catch(function(error) {
		console.log(error);
		Swal.fire(
		  'Error',
		  'Failed to connect to Coingecko.',
		  'error'
		)
	});   
	
}

var updatePrices = function(){
	Object.values(cTokens).forEach(function(item, index){
		if(typeof(compAccountValue[item.id]) == 'undefined') return;
		if(typeof(compAccountValue[item.id].lifetime_supply_interest_accrued) == 'undefined') return;
		if(!compAccountValue[item.id].lifetime_supply_interest_accrued) return;
		if(!prices[item.index]) return;
		
		var compValue = compAccountValue[item.id];
		var price = prices[item.index];
		
		var earned_idr = compValue.lifetime_supply_interest_accrued.value*price;
		$(`.val_${item.id}_earned_idr`).html(formatter.format(parseFloat(earned_idr).toFixed(0)));
		var underlying_idr = compValue.supply_balance_underlying.value*price;
		$(`.val_${item.id}_balance_underlying_idr`).html(formatter.format(parseFloat(underlying_idr).toFixed(0)));
		
	});
}

var displayCoinList = function(){
	Object.values(cTokens).forEach(function(item, index){
		var html = $($('#template_coin_item').html());
		$(html).find('img.coin-logo').attr('src', item.logo);
		$(html).find('.coin-name').html(item.name);
		$(html).find('.coin_val_apy').addClass('val_'+item.id+'_apy');
		$(html).find('.coin_val_earned').addClass('val_'+item.id+'_earned');
		$(html).find('.coin_val_earned_idr').addClass('val_'+item.id+'_earned_idr');
		$(html).find('.coin_val_balance_underlying').addClass('val_'+item.id+'_balance_underlying');
		$(html).find('.coin_val_balance_underlying_idr').addClass('val_'+item.id+'_balance_underlying_idr');
		$(html).find('.coin_btn_depo').attr('onclick', 'pop_depo(\''+item.id+'\'); return false;');
		$(html).find('.coin_btn_wd').attr('onclick', 'pop_wd(\''+item.id+'\'); return false;');
		
		$('#coins_container').append(html);
	})
}

var pop_depo = async function(id){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Silakan sambung browser denga MetaMask sebelum melanjutkan.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	if(cont.id!='eth'){
	
		var token = new web3.eth.Contract(erc20Abi, cont.underlyingaddress);
		var allowance = await token.methods.allowance(account, cont.address).call();
		allowance = allowance / Math.pow(10, cont.underlyingDecimals);
		console.log(allowance);
		if(allowance<999999998){ //allowance not enough, ask to approve
		
			pop_enable(cont);
			return;
		}
	}
	
	
	$('#depo-form .coin_img').attr('src', cont.logo);
	$('#depo-form .val_coin_name').html(cont.name);
	$('#depo-form .val_coin_balance').html('');
	$('#depo-form .val_coin_unit').html(cont.unit);
	$('#depo-form .coin_btn_lanjut').html('Lanjut').attr('onclick', 'go_depo(\''+cont.id+'\'); return false;');
	$('#depo_amount').attr('placeholder', 'Masukan jumlah '+cont.unit).val('');
	$('#depo_amount').val('');
	
	$.magnificPopup.open({
		items: {
			src: '#depo-form',
			type: 'inline'
		},
		showCloseBtn: false
	});
	
	var avail_balance = await getBalance(cont, account);
	
	$('#depo-form .val_coin_balance').html(parseFloat(avail_balance).toFixed(8));
	
}

var go_depo = async function(id){
	var cont;
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#depo_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Masukan angka yang valid.',
		  'error'
		)
		return false;
	}
	
	cToken =  new web3.eth.Contract(cont.abi, cont.address);
	
	$('#depo-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Buka MetaMask').attr('onclick', '');
	
	if(cont.id=='eth'){
	
		await cToken.methods.mint().send({
			from: account,
			value: web3.utils.toHex(web3.utils.toWei(amount, 'ether'))
		}, function(err, result){
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Gagal',
				  err.message,
				  'error'
				)
			} else {
				$.magnificPopup.close();
				Swal.fire(
				  'Transaksi Terkirim',
				  result+' <a href="https://etherscan.io/tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
	}
	else{
		var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals))+"";
		await cToken.methods.mint(raw_amount).send({
			from: account
		}, function(err, result){
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Gagal',
				  err.message,
				  'error'
				)
			} else {
				$.magnificPopup.close();
				Swal.fire(
				  'Transaksi Terkirim',
				  result+' <a href="https://etherscan.io/tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
	}
}

var pop_enable = function(cont){
	
	$('#enable-form .coin_img').attr('src', cont.logo);
	$('#enable-form .val_coin_name').html(cont.name);
	$('#enable-form .coin_btn_lanjut').html('Lanjut').attr('onclick', 'go_enable(\''+cont.id+'\'); return false;');
	
	$.magnificPopup.open({
		items: {
			src: '#enable-form',
			type: 'inline'
		},
		showCloseBtn: false
	});
}

var go_enable = async function(id){
	var cont;
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	$('#enable-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Buka MetaMask').attr('onclick', '');
	
	var token = new web3.eth.Contract(erc20Abi, cont.underlyingaddress);
	var raw_amount = 999999999*Math.pow(10, cont.underlyingDecimals);
	var allowance = await token.methods.approve(cont.address, raw_amount).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Gagal',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaksi Terkirim',
			  'Tunggu hingga transaksi terkonfirmasi, kemudian coba kembali.<br /><br />'+result+' <a href="https://etherscan.io/tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_wd = function(id){
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Silakan sambung browser denga MetaMask sebelum melanjutkan.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#wd-form .coin_img').attr('src', cont.logo);
	$('#wd-form .val_coin_name').html(cont.name);
	$('#wd-form .val_coin_balance').html('');
	$('#wd-form .val_coin_unit').html(cont.unit);
	$('#wd-form .coin_btn_lanjut').html('Lanjut').attr('onclick', 'go_wd(\''+cont.id+'\'); return false;');
	$('#wd_amount').attr('placeholder', 'Masukan jumlah '+cont.unit).val('');
	$('#wd_amount').val('');
	
	data = compAccountValue[cont.id];
	
	if(!data){
		$('#wd-form .val_coin_balance').html(0);
	}
	else{
		$('#wd-form .val_coin_balance').html(parseFloat(data.supply_balance_underlying.value).toFixed(8));
	}
	
	$.magnificPopup.open({
		items: {
			src: '#wd-form',
			type: 'inline'
		},
		showCloseBtn: false
	});
	
	
}

var go_wd = async function(id){
	var cont;
	Object.values(cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#wd_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Masukan angka yang valid.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Buka MetaMask').attr('onclick', '');
	
	var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals))+"";
	
	cToken =  new web3.eth.Contract(cont.abi, cont.address);
	
	await cToken.methods.redeemUnderlying(raw_amount).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Gagal',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaksi Terkirim',
			  result+' <a href="https://etherscan.io/tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var refreshData = function(){
	syncRate();
	getPrices();
	syncCompAccount(account);
}

var cTokens = new Object();
cTokens['eth'] = cEth
cTokens['bat'] = cBat
cTokens['dai'] = cDai
cTokens['rep'] = cRep
cTokens['usdt'] = cUsdt
cTokens['usdc'] = cUsdc
cTokens['wbtc'] = cWbtc
cTokens['zrx'] = cZrx

var compAccountValue = new Object();
var prices = new Object();	

$(function(){
	displayCoinList();
	refreshData();
});

setInterval(function(){
	refreshData();
}, 60000);