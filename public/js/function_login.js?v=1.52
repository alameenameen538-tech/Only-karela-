var waitReply = 0;

$(document).ready(function(){

	selectIt();
	bcCookie();
	
	$(document).keypress(function(e) {
		if(e.which == 13) {
			if($('#login_form_box:visible').length){
				sendLogin();
			}
			else if($('#registration_form_box:visible').length){
				sendRegistration();
			}
			else if($('#guest_form_box:visible').length){
				sendGuestLogin();
			}
			else {
				return false;
			}
		}
	});

});

coppaRule = function(){
	getCoppa();
}
bcCookie = function(){
	var checkCookie = navigator.cookieEnabled;
	if(checkCookie == false){
		alert("you need to enable cookie for the site to be able to log in");
	}
}
getLogin = function(){
	$.post('system/box/login.php', {
		}, function(response) {
			if(response != 0){
				showModal(response);
			}
			else {
				return false;
			}
	});
}
getLoginFail = function(){
	$.post('system/box/login_fail.php', {
		}, function(response) {
			showModal(response);
	});
}
getGuestLogin = function(){
	$.post('system/box/guest_login.php', {
		}, function(response) {
			if(response == 0){
				return false;
			}
			else if(response == 99){
				coppaRule();
			}
			else {
				showModal(response);
				renderCaptcha();
			}
	});
}
getRegistration = function(){
	$.post('system/box/registration.php', {
		}, function(response) {
			if(response == 0){
				return false;
			}
			else if(response == 99){
				coppaRule();
			}
			else {
				showModal(response);
				renderCaptcha();
			}
	});
}
getRecovery = function(){
	$.post('system/box/pass_recovery.php', {
		}, function(response) {
			if(response != 0){
				showModal(response);
			}
			else {
				return false;
			}
	});
}
getCoppa = function(){
	hideAllModal();
	$.post('system/box/coppa.php', {
		}, function(response) {
			if(response == 0){
				return false;
			}
			else {
				showModal(response);
			}
	});
}

hideArrow = function(d){
	if($("#last_active .last_10 .active_user").length <= d){
		$("#last_active .left-arrow, #last_active .right-arrow").hide();
	}
	else {
		$("#last_active .left-arrow, #last_active .right-arrow").show();	
	}
}
sendLogin = function(){

	var upass = $('#user_password').val();
	var uuser = $('#user_username').val();

	if(!validForm('user_password', 'user_username')){
		return false;
	}
	else {
		if(waitReply == 0){
			waitReply = 1;
			$.post('system/action/login.php', {
				password: upass,
				username: uuser
			}, function(response) {
				if (response.code == 1) {
					$('#user_password').val("");
				}
				else if (response.code == 17) {
					$('#login_recapt').removeClass('hidden');
				}
				else if (response.code == 2) {
					$('#user_password').val("");
				}
				else if (response.code == 99) {
					getLoginFail();
				}
				else if (response.code == 3) {
					location.reload();
				}
				waitReply = 0;
			}, 'json');
		}
		else {
			return false;
		}
	}
}
sendRegistration = function() {
	
	var upass = $('#reg_password').val();
	var uuser = $('#reg_username').val();
	var uemail = $('#reg_email').val();
	var ugender = $('#login_select_gender').val();
	var birth = buildDate();
	
	if(!validForm('reg_password', 'reg_username', 'reg_email')){
		return false;
	}
	else if(!validCaptcha()){
		return false;
	}
	else {
		if(waitReply == 0){
			waitReply = 1;
			$.post('system/action/registration.php', {
				password: upass,
				username: uuser,
				email: uemail,
				birth: birth,
				gender: ugender,
				recaptcha: getCaptcha(),
				}, function(response) {
					if(response.code != 1){
						resetCaptcha();
					}
					else if (response.code == 4){
						$('#reg_username').val("");
					}
					else if (response.code == 6){
						$('#reg_email').val("");
					}
					else if (response.code == 17){
						$('#reg_password').val("");
					}
					else if (response.code == 1){
						location.reload();
					}
					else if(response.code == 99){
						coppaRule();
					}
					else {
						waitReply = 0;
						return false;
					}
					waitReply = 0;
			}, 'json');
		}
		else{
			return false;
		}
	}
}
sendGuestLogin = function(){
	
	var gname = $('#guest_username').val();
	var ggender = $('#guest_gender').val();

	if(!validForm('guest_username')){
		return false;
	}
	else if(!validCaptcha()){
		return false;
	}
	else {
		if(waitReply == 0){
			waitReply = 1;	
			$.post('system/action/login.php', {
				gusername: gname,
				ggender: ggender,
				gbirth: buildDate(),
				recaptcha: getCaptcha(),
				}, function(response) {
					if(response.code != 1){
						resetCaptcha();
					}
					if (response.code == 4){
						$('#guest_username').val("");
					}
					else if(response.code == 99){
						coppaRule();
					}
					else if (response.code == 1){
						location.reload();
					}
					waitReply = 0;
			}, 'json');
		}
		else {
			return false;
		}
	}
}
sendRecovery = function() {
	var rEmail = $('#recovery_email').val();
	if(!validForm('recovery_email')){
		return false;
	}
	else {
		if(waitReply == 0){
			waitReply = 1;
			$.post('system/action/recovery.php', {
				remail: rEmail,
				}, function(response) {
					if (response.code == 1){
						$('#recovery_email').val("");
						hideModal();
					}
					else if (response.code == 2){
						$('#recovery_email').val("");
					}
					else if (response.code == 3){
						$('#recovery_email').val("");
					}
					else if (response.code == 0){
						hideAllModal();
					}
					waitReply = 0;
			}, 'json');
		}
		else {
			return false;
		}
	}
}
bridgeLogin = function(path){
	if(waitReply == 0){
		waitReply = 1;
		$.post('../boom_bridge.php', {
			path: path,
			special_login: 1,
			}, function(response) {
				if (response == 1){
					location.reload();
				}
				else {
					callError(system.site_connect);
				}
				waitReply = 0;
		});
	}
}
hideCookieBar = function(){
	$.post('system/action/cookie_law.php', {
		cookie_law: 1,
		}, function(response) {
			$('.cookie_wrap').fadeOut(400);
	});
}
readyCaptcha = function(){
	return false;
};