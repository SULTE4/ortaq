export type Status = 'New' | 'In Progress' | 'Resolved';
export type Vec3 = [number,number,number];
export interface Location {entrance:number;floor:number;area:string}
export interface Issue {id:string;building_id:number;reporter:number;title:string;description:string;category:string;location:Location;photo:string;status:Status;contractor:string;result_photo:string;history:{status:Status;at:string;note:string;photo:string}[];supporters:number[];created_at:string}
export interface Expense {id:string;category:string;amount:number;date:string;receipt:string;description:string}
export interface Report {id:string;month:string;expenses:Expense[];corrections:{note:string;at:string;expenses:Expense[]}[]}
export interface Poll {id:string;question:string;options:string[];closed:boolean;advisory:boolean;closes_at:string;total_votes:number;voted_apartments:number[];my_vote:number;results?:number[]}
export interface Snapshot {building:{id:number;name:string;address:string;apartments:number;floors:number;entrances:number};issues:Issue[];reports:Report[];announcements:{id:string;title:string;body:string;at:string}[];polls:Poll[];role:string;apartment:number;balances?:{apartment:number;amount:number}[]}
