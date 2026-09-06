selectIt();
$('#contact_message').val('');

sendContact = function(){
	contactSend(0);
	boomDelay(function() {
		
		var err = 0;
		var uname = $('#contact_name').val();
		var uemail = $('#contact_email').val();
		var umessage = $('#contact_message').val();

		if(!validForm('contact_name', 'contact_email', 'contact_message')){
			return false;
		}
		else if(!validCaptcha()){
			return false;
		}
		else {
			$.post('system/action/action_contact.php', {
				name: uname,
				email: uemail,
				message: umessage,
				recaptcha: getCaptcha(),
				}, function(response) {
					if(response.code == 1){
						contactSend(2);
					}
					else if(response.code  == 2){
						contactSend(1);
					}
					else if(response.code  == 3){
						contactSend(1);
					}
					else if(response.code  == 4){
						contactSend(3);
					}
					else if(response.code == 6){
						contactSend(1);
					}
					else {
						contactSend(4);
					}
			}, 'json');
		}
	}, 500);
}

contactSend = function(i){
	if(i == 0){
		$('.contact_send').hide();
	}
	else if(i == 1){
		resetCaptcha();
		$('.contact_send').show();
	}
	else if(i == 2){
		$('#contact_form').remove();
		$('#contact_sent').show();
	}
	else if(i == 3){
		$('#contact_form').remove();
		$('#contact_max').show();
	}
	else {
		$('#contact_form').remove();
		$('#contact_error').show();
	}
}

readyCaptcha = function(){
	renderCaptcha();
}

$(document).ready(function(){
});