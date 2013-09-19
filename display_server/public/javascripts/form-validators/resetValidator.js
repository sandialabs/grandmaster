// Copyright 2013 Sandia Corporation. Under the terms of Contract DE-AC04-94AL85000, there is a non-exclusive license for use of this work by or on behalf of the U.S. Government. Export of this program may require a license from the United States Government.

function ResetValidator(){
    
// modal window to allow users to reset their password //
    this.setPassword = $('#set-password');
    this.setPassword.modal({ show : false, keyboard : false, backdrop : 'static' });
    this.setPasswordAlert = $('#set-password .alert');
}

ResetValidator.prototype.validatePassword = function(s)
{
	if (s.length >= 6){
		return true;
	}	else{
		this.showAlert('Password Should Be At Least 6 Characters');
		return false;
	}
}

ResetValidator.prototype.showAlert = function(m)
{
	this.setPasswordAlert.attr('class', 'alert alert-error');
	this.setPasswordAlert.html(m);
	this.setPasswordAlert.show();
}

ResetValidator.prototype.hideAlert = function()
{
    this.setPasswordAlert.hide();
}

ResetValidator.prototype.showSuccess = function(m)
{
	this.setPasswordAlert.attr('class', 'alert alert-success');
	this.setPasswordAlert.html(m);
	this.setPasswordAlert.fadeIn(500);
}
