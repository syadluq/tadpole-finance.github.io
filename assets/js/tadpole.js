
var accountBalance = new Object();
var accountBorrow = new Object();
var prices = new Object();	
var assetsIn;
var accountLiquidityAvailable;

var formatter = new Intl.NumberFormat('us-US', {
  style: 'currency',
  currency: 'USD',
});

var _MAINNET_ENV = {
	"id": 1,
	"comptrollerAddress": "0x505E1c2BFfe0Bf14b9f5521e4F4233FF977a2395",
	"oracleAddress": "0x0f03a46E1c3393B5ef90BB6c297197274c71e7Bc",
	"etherscan": "https://etherscan.io/",
	"cTokens": {
		"idk": {
			"id": "idk",
			"name": "IDK",
			"index": "idk",
			"unit": "IDK",
			"logo": "./assets/images/tokens/idk_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 8,
			"address": "0x603ea7d47e461998e794FC60bA1062E420dfB76e",
			"underlyingAddress": "0xf32789C480Cd5944AE1539c83e33380439b14bb3"
		},
		"ten": {
			"id": "ten",
			"name": "TEN",
			"index": "tokenomy",
			"unit": "TEN",
			"logo": "./assets/libs/cryptocurrency-icons/32/color/ten.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 18,
			"address": "0x8e82Fe91Ebc61842ABB6c5cfe324e04f5E396335",
			"underlyingAddress": "0x56C0369E002852C2570ca0CC3442E26df98E01A2"
		}
	}
}

var _GOERLI_ENV = {
	"id": 5,
	"comptrollerAddress": "0x505E1c2BFfe0Bf14b9f5521e4F4233FF977a2395",
	"oracleAddress": "0x0f03a46E1c3393B5ef90BB6c297197274c71e7Bc",
	"etherscan": "https://goerli.etherscan.io/",
	"cTokens": {
		"idk": {
			"id": "idk",
			"name": "IDK",
			"index": "idk",
			"unit": "IDK",
			"logo": "./assets/images/tokens/idk_32.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 8,
			"address": "0x603ea7d47e461998e794FC60bA1062E420dfB76e",
			"underlyingAddress": "0xf32789C480Cd5944AE1539c83e33380439b14bb3"
		},
		"ten": {
			"id": "ten",
			"name": "TEN",
			"index": "tokenomy",
			"unit": "TEN",
			"logo": "./assets/libs/cryptocurrency-icons/32/color/ten.png",
			"cTokenDecimals": 8,
			"underlyingDecimals": 18,
			"address": "0x8e82Fe91Ebc61842ABB6c5cfe324e04f5E396335",
			"underlyingAddress": "0x56C0369E002852C2570ca0CC3442E26df98E01A2"
		}
	}
}

var ENV = _MAINNET_ENV;
var OLD_ENVID;
change_environment = function(chainId){
	if(!chainId) return false;
	
	OLD_ENVID = ENV.id;
	
	if(chainId=='0x1'||chainId=='0x01'){ //mainnet
		ENV = _MAINNET_ENV;
	}
	else if(chainId=='0x5'||chainId=='0x05'){
		ENV = _GOERLI_ENV;
		
	}
	else{
		Swal.fire(
		  'Only support Mainnet and Goerli',
		  '',
		  'warning'
		)
		return false;
	}
	
	syncCont();
	
	if(OLD_ENVID!=ENV.id){
		displayCoinList();
		refreshData();
	}
	
	return true;
}

var syncCont = function(){
	ENV.comptrollerContract = new web3.eth.Contract(comptrollerAbi, ENV.comptrollerAddress);
	ENV.oracleContract = new web3.eth.Contract(oracleAbi, ENV.oracleAddress);
	Object.values(ENV.cTokens).forEach(async function(cToken, index){
		ENV.cTokens[cToken.id].contract = new web3.eth.Contract(cErc20Abi, cToken.address);
	});
}

const blocksPerDay = 4 * 60 * 24;
const daysPerYear = 365;
const mentissa = 1e18;

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

var syncRate = function(){
	Object.values(ENV.cTokens).forEach(async function(cToken, index){
	
		var supplyRatePerBlock = await cToken.contract.methods.supplyRatePerBlock().call();
		var borrowRatePerBlock = await cToken.contract.methods.borrowRatePerBlock().call();
		var supplyApy = (((Math.pow((supplyRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		var borrowApy = (((Math.pow((borrowRatePerBlock / mentissa * blocksPerDay) + 1, daysPerYear - 1))) - 1) * 100;
		
		$(`.val_${cToken.id}_apy`).html(supplyApy.toFixed(2)+'%');
		$(`.val_${cToken.id}_rate`).html(borrowApy.toFixed(2)+'%');
		
		
		
	});
	
}

var getBalance = async function(cToken, address){
			
	if(!address){
		return 0;
	}
	
	if(cToken.id=='eth'){
		var balance = await web3.eth.getBalance(address);
		balance = web3.utils.fromWei(balance);
		return balance;
	}
	
	var token = new web3.eth.Contract(erc20Abi, cToken.underlyingAddress);
	var balance = await token.methods.balanceOf(address).call();
	
	balance = balance / Math.pow(10, cToken.underlyingDecimals);
	
	return balance;
	
}

var syncAccount = async function(address){
			
	if(!address){
		Object.values(ENV.cTokens).forEach(function(cToken, cIndex){
			$(`.val_${cToken.id}_balance_underlying`).html('0 '+cToken.unit);
			$(`.val_${cToken.id}_balance_borrow`).html('0 '+cToken.unit);
		});
		return;
	}
	
	$('.refresh-btn').addClass('mdi-spin');
	
	var i = 0;
	
	var assetsIn = await ENV.comptrollerContract.methods.getAssetsIn(address).call();
	
	Object.values(ENV.cTokens).forEach(async function(cToken, cIndex){
		var exchangeRateStored = await cToken.contract.methods.exchangeRateStored().call();
		var cTokenBalance = await cToken.contract.methods.balanceOf(address).call();
		var underlyingBalance = cTokenBalance*exchangeRateStored / (Math.pow (10, 18 + cToken.underlyingDecimals));
		
		accountBalance[cToken.id] = underlyingBalance;
		
		$(`.val_${cToken.id}_balance_underlying`).html(parseFloat(underlyingBalance).toFixed(8)+' '+cToken.unit);
		
		var borrowBalanceStored = await cToken.contract.methods.borrowBalanceStored(address).call();
		var borrowBalance = borrowBalanceStored/Math.pow(10, cToken.underlyingDecimals);
		
		accountBorrow[cToken.id] = new Object();
		
		accountBorrow[cToken.id] = borrowBalance;
		
		$(`.val_${cToken.id}_balance_borrow`).html(parseFloat(borrowBalance).toFixed(8)+' '+cToken.unit);
		
		if($.inArray(cToken.address, assetsIn) >= 0){
			//collateral is enabled
			$('#'+cToken.id+'_is_collateral').prop( "checked", true );
		}
		else{
			//collateral is disabled
			$('#'+cToken.id+'_is_collateral').prop( "checked", false );
		}
		
		i++;
		if(i==Object.keys(ENV.cTokens).length) getPrices();
	});
	
	
	$('.refresh-btn').removeClass('mdi-spin');
}

var getPrices = async function(){
	
	var addresses = '';
	var i = 0;
	
	Object.values(ENV.cTokens).forEach(async function(CToken, cIndex){
		prices[CToken.id] = await ENV.oracleContract.methods.getUnderlyingPrice(CToken.address).call() / Math.pow(10, 36-CToken.underlyingDecimals);
		
		i++;
		if(i==Object.keys(ENV.cTokens).length) updatePrices();
	});
	
}

var updatePrices = function(){
	
	var supplyInUsd = 0;
	var borrowInUsd = 0;
	
	var i = 0;
	
	Object.values(ENV.cTokens).forEach(function(cToken, index){
		if(!prices[cToken.id]) return;
		
		var balance = accountBalance[cToken.id];
		var price = prices[cToken.id];
		
		var underlying_usd = balance*price;
		
		supplyInUsd += underlying_usd;
		
		$(`.val_${cToken.id}_balance_underlying_usd`).html(formatter.format(parseFloat(underlying_usd).toFixed(2)));
		
		var borrow = accountBorrow[cToken.id];
		var borrow_usd = borrow*price;
		
		borrowInUsd += borrow_usd;
		
		$(`.val_${cToken.id}_balance_borrow_usd`).html(formatter.format(parseFloat(borrow_usd).toFixed(2)));
		
		
		i++;
		if(i==Object.keys(ENV.cTokens).length){ 
			$('.supply-balance').html(formatter.format(parseFloat(supplyInUsd).toFixed(2)));
			$('.borrow-balance').html(formatter.format(parseFloat(borrowInUsd).toFixed(2)));
			updateBorrowLimit(borrowInUsd);
		}
		
	});
	
	
}

var updateBorrowLimit = async function(borrowInUsd){
	var temp = await ENV.comptrollerContract.methods.getAccountLiquidity(account).call();
	var accountLiquidity = temp[1];
	var accountLiquidityUsd = accountLiquidity / mentissa;
	var totalLimitUsd = accountLiquidityUsd + borrowInUsd;
	var borrowPercentage = parseFloat(borrowInUsd/totalLimitUsd*100).toFixed(2);
	
	accountLiquidityAvailable = accountLiquidity;
	
	$('.borrow-limit').html(formatter.format(parseFloat(totalLimitUsd).toFixed(2)));
	
	var borrowPercentageString = borrowPercentage+"%";
	$('.borrow-percentage').html(borrowPercentageString).css({width: borrowPercentageString}).attr('aria-valuenow', borrowPercentage).attr('aria-valuemin', borrowPercentage);
}

var enableCollateral = async function(cTokenId){
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	await ENV.comptrollerContract.methods.entertMarkets([cont.address]).send({
			from: account
		}, function(err, result){
		if (err) {
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			);
		} else {
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var disableCollateral = async function(id){
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	await ENV.comptrollerContract.methods.exitMarket(cont.address).send({
			from: account
		}, function(err, result){
		if (err) {
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			);
		} else {
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var displayCoinList = function(){
	cTokens = ENV.cTokens;
	
	$('.supplies_container').html('');
	Object.values(cTokens).forEach(function(item, index){
		var html = $($('#template_supply_item').html());
		$(html).find('img.coin-logo').attr('src', item.logo);
		$(html).find('.coin-name').html(item.unit);
		$(html).find('.coin_val_apy').addClass('val_'+item.id+'_apy');
		$(html).find('.coin_val_balance_underlying').addClass('val_'+item.id+'_balance_underlying');
		$(html).find('.coin_val_balance_underlying_usd').addClass('val_'+item.id+'_balance_underlying_usd');
		$(html).addClass('supply-item').attr('token', item.id);
		$(html).find('input[type="checkbox"]').attr('id', item.id+'_is_collateral');
		$(html).find('.custom-control-label').attr('for', item.id+'_is_collateral');
		$(html).find('input[type="checkbox"]').click(function(e){
			var isChecked = $(e.target).is(':checked');
			if(isChecked) enableCollateral(item.id);
			else disableCollateral(item.id);
		});
		
		
		$(html).click(function(e){
			if( 
				$(e.target).closest(".collateral-col").length == 0 &&
				$(e.target).closest("abbr").length == 0 
			) {
				pop_depo(item.id);
			}
			
		});
		
		$('.supplies_container').append(html);
	});
	
	$('.borrows_container').html('');
	Object.values(cTokens).forEach(function(item, index){
		var html = $($('#template_borrow_item').html());
		$(html).find('img.coin-logo').attr('src', item.logo);
		$(html).find('.coin-name').html(item.unit);
		$(html).find('.coin_val_rate').addClass('val_'+item.id+'_rate');
		$(html).find('.coin_val_balance_borrow').addClass('val_'+item.id+'_balance_borrow');
		$(html).find('.coin_val_balance_borrow_usd').addClass('val_'+item.id+'_balance_borrow_usd');
		
		
		$(html).click(function(e){
			if( 
				$(e.target).closest("abbr").length == 0 
			) {
				pop_borrow(item.id);
			}
			
		});
		
		$('.borrows_container').append(html);
	});
}

var pop_depo = async function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect to MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	if(cont.id!='eth'){
	
		var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
		var allowance = await token.methods.allowance(account, cont.address).call();
		allowance = allowance / Math.pow(10, cont.underlyingDecimals);
		if(allowance<9999999999){ //allowance not enough, ask to approve
		
			pop_enable(cont);
			return;
		}
	}
	
	
	$('#depo-form .coin_img').attr('src', cont.logo);
	$('#depo-form .val_coin_name').html(cont.name);
	$('#depo-form .val_coin_balance').html('');
	$('#depo-form .val_coin_unit').html(cont.unit);
	$('#depo-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_depo(\''+cont.id+'\'); return false;');
	$('#depo-form .coin_btn_redeem').attr('onclick', 'pop_wd(\''+cont.id+'\'); return false;');
	$('#depo_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#depo_amount').val('');
	
	setTimeout(function(){
		
		$.magnificPopup.open({
			items: {
				src: '#depo-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
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
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	cToken =  new web3.eth.Contract(cErc20Abi, cont.address);
	
	$('#depo-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	if(cont.id=='eth'){
	
		await cToken.methods.mint().send({
			from: account,
			value: web3.utils.toHex(web3.utils.toWei(amount, 'ether'))
		}, function(err, result){
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Failed',
				  err.message,
				  'error'
				)
			} else {
				$.magnificPopup.close();
				Swal.fire(
				  'Transaksi Terkirim',
				  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
	}
	else{
		var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
		await cToken.methods.mint(numberToString(raw_amount)).send({
			from: account
		}, function(err, result){
			if (err) {
				$.magnificPopup.close();
				Swal.fire(
				  'Failed',
				  err.message,
				  'error'
				)
			} else {
				$.magnificPopup.close();
				Swal.fire(
				  'Transaksi Terkirim',
				  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
				  'success'
				)
			}
		});
		
	}
}

var pop_enable = function(cont){
	
	$('#enable-form .coin_img').attr('src', cont.logo);
	$('#enable-form .val_coin_name').html(cont.name);
	$('#enable-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_enable(\''+cont.id+'\'); return false;');
	
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
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	$('#enable-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var token = new web3.eth.Contract(erc20Abi, cont.underlyingAddress);
	var raw_amount = 99999999999999999999*Math.pow(10, cont.underlyingDecimals);
	var allowance = await token.methods.approve(cont.address, numberToString(raw_amount)).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaction Sent',
			  'Please wait the transaction to be confirmed, then you can start to supply this token.<br /><br />'+result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_wd = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect to MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#wd-form .coin_img').attr('src', cont.logo);
	$('#wd-form .val_coin_name').html(cont.name);
	$('#wd-form .val_coin_balance').html('');
	$('#wd-form .val_coin_unit').html(cont.unit);
	$('#wd-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_wd(\''+cont.id+'\'); return false;');
	$('#wd-form .coin_btn_depo').attr('onclick', 'pop_depo(\''+cont.id+'\'); return false;');
	$('#wd_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#wd_amount').val('');
	
	var balance = accountBalance[cont.id];
	
	if(!balance){
		$('#wd-form .val_coin_balance').html(0);
	}
	else{
		$('#wd-form .val_coin_balance').html(parseFloat(balance).toFixed(8));
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#wd-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_wd = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#wd_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
	
	await cont.contract.methods.redeemUnderlying(numberToString(raw_amount)).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_borrow = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect to MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#borrow-form .coin_img').attr('src', cont.logo);
	$('#borrow-form .val_coin_name').html(cont.name);
	$('#borrow-form .val_coin_maxborrow').html('');
	$('#borrow-form .val_coin_unit').html(cont.unit);
	$('#borrow-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_borrow(\''+cont.id+'\'); return false;');
	$('#borrow-form .coin_btn_repay').attr('onclick', 'pop_repay(\''+cont.id+'\'); return false;');
	$('#borrow_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#borrow_amount').val('');
	
	var maxBorrow = accountLiquidityAvailable / mentissa / prices[cont.id];
	
	if(!maxBorrow){
		$('#borrow-form .val_coin_maxborrow').html(0);
	}
	else{
		$('#borrow-form .val_coin_maxborrow').html(parseFloat(maxBorrow).toFixed(8));
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#borrow-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_borrow = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#borrow_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = Math.floor(amount * Math.pow(10, cont.underlyingDecimals));
	
	await cont.contract.methods.borrow(numberToString(raw_amount)).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var pop_repay = function(id){
	
	$.magnificPopup.close();
	
	if(!account){
		Swal.fire(
		  'Error',
		  'Connect to MetaMask to continue.',
		  'error'
		)
		return;
	}
	
	var cont;
	
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	
	
	$('#repay-form .coin_img').attr('src', cont.logo);
	$('#repay-form .val_coin_name').html(cont.name);
	$('#repay-form .val_coin_debt').html('');
	$('#repay-form .val_coin_unit').html(cont.unit);
	$('#repay-form .coin_btn_lanjut').html('Continue').attr('onclick', 'go_repay(\''+cont.id+'\'); return false;');
	$('#repay-form .coin_btn_borrow').attr('onclick', 'pop_borrow(\''+cont.id+'\'); return false;');
	$('#repay_amount').attr('placeholder', 'Enter the amount of '+cont.unit).val('');
	$('#repay_amount').val('').prop('disabled', false);
	$('#fullrepay').html(parseFloat(debt).toFixed(8)).prop('checked', false).attr('onchange', 'togglerepay(\''+cont.id+'\', true); return false;');
	
	var debt = accountBorrow[cont.id];
	
	if(!debt){
		$('#repay-form .val_coin_debt').html(0);
	}
	else{
		$('#repay-form .val_coin_debt').html(parseFloat(debt).toFixed(8)).attr('onclick', 'togglerepay(\''+cont.id+'\'); return false;');
	}
	
	setTimeout(function(){
	
		$.magnificPopup.open({
			items: {
				src: '#repay-form',
				type: 'inline'
			},
			showCloseBtn: false
		});
	
	}, 5);
	
}

var go_repay = async function(id){
	var cont;
	Object.values(ENV.cTokens).forEach(function(cItem, cIndex){
		if(cItem.id == id) cont = cItem;
	});
	var amount = $('#repay_amount').val();
	if(!amount||isNaN(amount)||amount<=0){
		Swal.fire(
		  'Error',
		  'Enter valid amount.',
		  'error'
		)
		return false;
	}
	
	$('#wd-form .coin_btn_lanjut').html('<span class="mdi mdi-loading mdi-spin"></span> Open MetaMask').attr('onclick', '');
	
	var raw_amount = numberToString(Math.floor(amount * Math.pow(10, cont.underlyingDecimals)));
	
	if($('#fullrepay').is(':checked')){
		raw_amount = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
	}
	
	await cont.contract.methods.repayBorrow(raw_amount).send({
		from: account
	}, function(err, result){
		if (err) {
			$.magnificPopup.close();
			Swal.fire(
			  'Failed',
			  err.message,
			  'error'
			)
		} else {
			$.magnificPopup.close();
			Swal.fire(
			  'Transaction Sent',
			  result+' <a href="'+ENV.etherscan+'tx/'+result+'" target="_blank"><span class="mdi mdi-open-in-new"></span></a>',
			  'success'
			)
		}
	});
}

var togglerepay = function(id, reverse=false){
	var debt = accountBorrow[id];
	
	var checked = $('#fullrepay').is(':checked');
	if(reverse) checked = !checked;
		
	if(checked){
		$('#repay_amount').val('').prop('disabled', false);
		$('#fullrepay').prop('checked', false);
	}
	else{
		$('#repay_amount').val(parseFloat(debt).toFixed(8)).prop('disabled', true);
		$('#fullrepay').prop('checked', true);
	}
}

var refreshData = function(){
	syncRate();
	syncAccount(account);
}

function numberToString(num)
{
    let numStr = String(num);

    if (Math.abs(num) < 1.0)
    {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e)
        {
            let negative = num < 0;
            if (negative) num *= -1
            num *= Math.pow(10, e - 1);
            numStr = '0.' + (new Array(e)).join('0') + num.toString().substring(2);
            if (negative) numStr = "-" + numStr;
        }
    }
    else
    {
        let e = parseInt(num.toString().split('+')[1]);
        if (e > 20)
        {
            e -= 20;
            num /= Math.pow(10, e);
            numStr = num.toString() + (new Array(e + 1)).join('0');
        }
    }

    return numStr;
}

$(function(){
	syncCont();
	displayCoinList();
	refreshData();
});

setInterval(function(){
	refreshData();
}, 60000);