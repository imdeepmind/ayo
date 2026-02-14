export namespace auth {
	
	export class LoginInput {
	    Username: string;
	    Password: string;
	
	    static createFrom(source: any = {}) {
	        return new LoginInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Username = source["Username"];
	        this.Password = source["Password"];
	    }
	}
	export class RegisterInput {
	    Username: string;
	    Password: string;
	
	    static createFrom(source: any = {}) {
	        return new RegisterInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Username = source["Username"];
	        this.Password = source["Password"];
	    }
	}
	export class ResetPasswordInput {
	    Username: string;
	    NewPassword: string;
	    RecoveryKey: string;
	
	    static createFrom(source: any = {}) {
	        return new ResetPasswordInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Username = source["Username"];
	        this.NewPassword = source["NewPassword"];
	        this.RecoveryKey = source["RecoveryKey"];
	    }
	}
	export class Session {
	    UserId: number;
	    Username: string;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UserId = source["UserId"];
	        this.Username = source["Username"];
	    }
	}
	export class User {
	    ID: number;
	    Username: string;
	    PasswordHash: string;
	    RecoveryKey: string;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Username = source["Username"];
	        this.PasswordHash = source["PasswordHash"];
	        this.RecoveryKey = source["RecoveryKey"];
	    }
	}

}

