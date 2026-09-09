export type NotificationRule={id:string;ruleType:'order_received'|'champagne_order_received';isEnabled:boolean;popupMode:'none'|'toast'|'sticky'|'banner';soundId:string|null};
export type NotificationSettings={revision:number;rules:NotificationRule[]};
export type NotificationSound={id:string;name:string;systemCode:string|null;durationMs:number};
export type NotificationDelivery={id:string;createdAt:string;expiresAt:string;readAt:string|null;content:{orderId:string;title:string;message:string;popupMode:NotificationRule['popupMode'];soundId:string|null;isBroadcast:boolean;matchedRules:string[]}};
export type NotificationInbox={items:NotificationDelivery[];unreadCount:number};
export type NotificationCapabilities={enabled:boolean;ruleTypes:string[];delivery:string;soundUploadConfigured:boolean};
export type NotificationCenterValue={inbox:NotificationInbox;state:string;read:(ids:string[])=>Promise<void>;enableAudio:()=>Promise<void>;enabled:boolean;audioError:string;desktop:boolean;enableDesktop:()=>Promise<void>};
