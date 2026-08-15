//
//  WXApiSimulatorStub.m
//  Simulator-only stub for WeChat OpenSDK (device builds link libWechatOpenSDK).
//

#if TARGET_OS_SIMULATOR

#import "WXApi.h"

@implementation WXApi

+ (BOOL)registerApp:(NSString *)appid universalLink:(NSString *)universalLink {
    (void)appid;
    (void)universalLink;
    return YES;
}

+ (BOOL)handleOpenURL:(NSURL *)url delegate:(id<WXApiDelegate>)delegate {
    (void)url;
    (void)delegate;
    return NO;
}

+ (BOOL)handleOpenUniversalLink:(NSUserActivity *)userActivity delegate:(id<WXApiDelegate>)delegate {
    (void)userActivity;
    (void)delegate;
    return NO;
}

+ (BOOL)isWXAppInstalled {
    return NO;
}

+ (BOOL)isWXAppSupportApi {
    return NO;
}

+ (void)sendReq:(BaseReq *)req completion:(void (^)(BOOL))completion {
    (void)req;
    if (completion) {
        dispatch_async(dispatch_get_main_queue(), ^{
            completion(NO);
        });
    }
}

@end

#endif
