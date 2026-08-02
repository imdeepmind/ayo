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
	export class User {
	    ID: number;
	    Username: string;
	    PasswordHash: string;
	    RecoveryKey: string;
	    PasswordSalt: number[];
	    PasswordNonce: number[];
	    PasswordMasterKey: number[];
	    RecoverySalt: number[];
	    RecoveryNonce: number[];
	    RecoveryMasterKey: number[];
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.Username = source["Username"];
	        this.PasswordHash = source["PasswordHash"];
	        this.RecoveryKey = source["RecoveryKey"];
	        this.PasswordSalt = source["PasswordSalt"];
	        this.PasswordNonce = source["PasswordNonce"];
	        this.PasswordMasterKey = source["PasswordMasterKey"];
	        this.RecoverySalt = source["RecoverySalt"];
	        this.RecoveryNonce = source["RecoveryNonce"];
	        this.RecoveryMasterKey = source["RecoveryMasterKey"];
	    }
	}
	export class RegisterResult {
	    User?: User;
	    RecoveryKey: string;
	
	    static createFrom(source: any = {}) {
	        return new RegisterResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.User = this.convertValues(source["User"], User);
	        this.RecoveryKey = source["RecoveryKey"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
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
	    MasterKey: number[];
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.UserId = source["UserId"];
	        this.Username = source["Username"];
	        this.MasterKey = source["MasterKey"];
	    }
	}

}

export namespace settings {
	
	export class Settings {
	    StorageMode: string;
	    CloudKeys: any[];
	    ErasureCoding: boolean;
	    ErasureCodingConfig: string;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.StorageMode = source["StorageMode"];
	        this.CloudKeys = source["CloudKeys"];
	        this.ErasureCoding = source["ErasureCoding"];
	        this.ErasureCodingConfig = source["ErasureCodingConfig"];
	    }
	}
	export class UpdateSettingsInput {
	    StorageMode: string;
	    CloudKeys: any[];
	    ErasureCoding: boolean;
	    ErasureCodingConfig: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateSettingsInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.StorageMode = source["StorageMode"];
	        this.CloudKeys = source["CloudKeys"];
	        this.ErasureCoding = source["ErasureCoding"];
	        this.ErasureCodingConfig = source["ErasureCodingConfig"];
	    }
	}

}

export namespace upload {
	
	export class EnqueueFileInput {
	    Name: string;
	    CustomName: string;
	    Path: string;
	    Size: number;
	    Tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new EnqueueFileInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.CustomName = source["CustomName"];
	        this.Path = source["Path"];
	        this.Size = source["Size"];
	        this.Tags = source["Tags"];
	    }
	}
	export class EnqueueFilesInput {
	    Files: EnqueueFileInput[];
	
	    static createFrom(source: any = {}) {
	        return new EnqueueFilesInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Files = this.convertValues(source["Files"], EnqueueFileInput);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EnqueuedJob {
	    ID: number;
	    File: string;
	    CustomName: string;
	    Status: string;
	    Progress: number;
	    Tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new EnqueuedJob(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ID = source["ID"];
	        this.File = source["File"];
	        this.CustomName = source["CustomName"];
	        this.Status = source["Status"];
	        this.Progress = source["Progress"];
	        this.Tags = source["Tags"];
	    }
	}
	export class PickedFile {
	    Name: string;
	    Path: string;
	    Size: number;
	
	    static createFrom(source: any = {}) {
	        return new PickedFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.Path = source["Path"];
	        this.Size = source["Size"];
	    }
	}

}

