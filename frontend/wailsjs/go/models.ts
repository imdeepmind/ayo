export namespace model {
	
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

