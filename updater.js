/* eslint-disable no-async-promise-executor */
/* eslint-disable promise/avoid-new */
console.debug(`📦  you are here → entering @titanium/updater`);

// TIBUG: Need to define these as Titanium isn't parsing things in node_modules properly
const OS_IOS = Titanium.App.iOS;
const OS_ANDROID = !Titanium.App.iOS;

const moment = require('moment');
const semver = require('./semver');
// const turbo = require('/turbo');
// console.debug(`turbo: ${JSON.stringify(turbo, null, 2)}`);
const Please = require('@titanium/please');

class Updater {
	constructor({
		url,
		timeout = 60000,
		id = turbo.app_id,
		platform = turbo.os_name_full,
		version = turbo.app_version,
		baseUrl,
		channel = 'release',
		// message = `We've delivered a shiny, new version of the app but we need you need to update the app in order to continue.`,
	} = {}) {
		turbo.trace('📦  you are here →  @titanium/updater.constructor()');
		if (!url && !baseUrl) {
			throw new Error('@titanium/updater requires either baseUrl or url');
		}
		this.url = url;
		this.baseUrl = baseUrl;
		this.id = id;
		this.platform = platform;
		this.version = version;
		this.timeout = timeout;
		this.platform_lower = platform.toLowerCase();
		this.channel = channel;

		if (!url) {
			this.url = `${this.baseUrl}/${this.id}/${this.platform_lower}/app-channel-${this.channel}.json`;
			if (this.channel !== 'release') {
				this.url_fallback = `${this.baseUrl}/${this.id}/${this.platform_lower}/app-channel-release.json`;
			}

		}

		this.appInfoPlease = new Please({
			baseUrl: this.url,
			timeout,
			headers: {
				'Cache-Control':   'no-cache',
				'Accept-Encoding': 'identity',
			},
		});
		// this.message = message;
	}

	async ensure({ recommended = true, optional = false, openHomePage = false } = {}) {
		turbo.trace('📦  you are here →  @titanium/updater.ensure');

		turbo.debug(`🦠  recommended: ${JSON.stringify(recommended, null, 2)}`);
		turbo.debug(`🦠  optional: ${JSON.stringify(optional, null, 2)}`);
		turbo.debug(`🦠  openHomePage: ${JSON.stringify(openHomePage, null, 2)}`);

		return new Promise(async (resolve, reject) => {
			let result;

			try {
				result = await this.appInfoPlease
					.debug(turbo.VERBOSE_MODE)
					.get();
			} catch (error) {
				turbo.trace(`📌  you are here → updater.appInfoPlease.catch`);
				turbo.debug(`🦠  error: ${JSON.stringify(error, null, 2)}`);

				if (this.url_fallback) {
					result = await this.appInfoPlease
						.url(this.url_fallback)
						.debug(turbo.VERBOSE_MODE)
						.get();
				} else {
					throw error;
				}

			}


			turbo.trace('📦  you are here →  @titanium/updater.ensure.then()');

			const appInfo = result.json || {};
			turbo.debug(`🦠  appInfo: ${JSON.stringify(appInfo, null, 2)}`);

			if (!appInfo.latest) {
				console.warn(`no app version info found for app: ${this.id} platform: ${this.platform}`);
				return resolve(true);
			}

			const meetsRequired = semver.satisfies(semver.coerce(this.version), appInfo.required);
			const meetsRecommended = semver.satisfies(semver.coerce(this.version), appInfo.recommended);
			const meetsOptional = semver.gte(semver.coerce(this.version), appInfo.latest);

			console.debug(`🦠  currentVersion: ${JSON.stringify(this.version, null, 2)}`);
			console.debug(`🦠  latestVersion: ${JSON.stringify(appInfo.latest, null, 2)}`);
			console.debug(`🦠  meetsRequired: ${JSON.stringify(meetsRequired, null, 2)}`);
			console.debug(`🦠  meetsRecommended: ${JSON.stringify(meetsRecommended, null, 2)}`);
			console.debug(`🦠  meetsOptional: ${JSON.stringify(meetsOptional, null, 2)}`);

			if (meetsRequired) {
				console.info(`App version ${this.version} meets requirements of: ${appInfo.required}`);

				if (recommended && meetsRecommended) {
					console.info(`App version ${this.version} meets recommendations of: ${appInfo.recommended}`);

					if (optional && meetsOptional) {
						console.info(`App version ${this.version} meets optional updates of: >=${appInfo.latest}`);
						return resolve(true);
					} else if (! optional) {
						return resolve(true);
					}
				} else if (! recommended) {
					return resolve(true);
				}

			}

			const release = _.find(appInfo.releases, { version: appInfo.latest });

			const handleUpdateEvent = async (e, args) => {
				turbo.trace(`📦  you are here → @titanium/updater handling event - updater::update`);

				// Open homepage as possible workaround for possible Android issues
				if (openHomePage) {

					const alertNotice = Ti.UI.createAlertDialog({
						cancel:      1,
						title:       'Updated Version',
						message:     'This will open the web page where you can download and install the latest version of the app.',
						buttonNames: [ 'Continue', 'Cancel'  ],
					});

					alertNotice.addEventListener('click', async event => {

						if (event.index === event.source.cancel) {
							turbo.trace(`📌  you are here → updater: update cancelled`);
							if (meetsRequired) {
								Alloy.close('update-required');
								return resolve();
							}
						} else {
							Ti.Platform.openURL(appInfo.homepage);
							if (meetsRequired) {
								Alloy.close('update-required');
								return resolve();
							}
						}

					});

					turbo.trace(`📌  you are here → alertNotice.show()`);
					alertNotice.show();
					return;

				}

				turbo.events.off('updater::update', handleUpdateEvent);
				const install_url = release['install-url'];
				console.debug(`🦠  install_url: ${JSON.stringify(install_url, null, 2)}`);

				Alloy.close('update-required');
				turbo.openLoadingScreen();
				if (OS_IOS) {
					Titanium.Platform.openURL(install_url, {}, e => {
						turbo.trace(`📦  you are here → @titanium/updater updater::update openURL handler`);
					});
				} else {
					// Titanium.Platform.openURL(install_url, {}, e => {
					// 	turbo.trace(`📦  you are here → @titanium/updater updater::update openURL handler`);
					// 	turbo.openLoadingScreen();
					// });

					try {

						const apk = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, 'update.apk');

						const apkPlease = new Please({
							baseUrl: install_url,
							timeout: this.timeout,
							headers: { 'Cache-Control': 'no-cache' },
							file:    apk,
						});

						await apkPlease.get();

						const alertNotice = Ti.UI.createAlertDialog({
							cancel:      1,
							title:       'Update downloaded',
							message:     'Please follow prompting to install the update.\n\nNOTE: You will have to manually relaunch the app after the update.',
							buttonNames: [ 'Continue', 'Cancel'  ],
						});

						alertNotice.addEventListener('click', async event => {

							if (event.index === event.source.cancel) {
								turbo.trace(`📌  you are here → updater: update cancelled`);
								alertNotice.hide();
								// await Promise.delay(1000);

								// Ti.Platform.openURL(appInfo.homepage);
								turbo.events.fire('updater::ignore');
								resolve();


							} else {
								turbo.events.off(`updater::ignore`, handleIgnoreEvent);
								install_android_apk();
							}

						});
						// Ti.Analytics.featureEvent('update:fail');
						// Alloy.Globals.ACA.logHandledException(e);

						turbo.trace(`📌  you are here → alertNotice.show()`);
						alertNotice.show();

						const install_android_apk = () => {
							turbo.trace(`📌  you are here → updater.install_android_apk()`);
							setTimeout(() => {
								let intent = Ti.Android.createIntent({});
								// intent.putExtraUri('uri', apk.nativePath);

								turbo.debug(`🦠  apk.nativePath: ${JSON.stringify(apk.nativePath, null, 2)}`);
								intent = Ti.Android.createIntent({
									action: 'android.intent.action.INSTALL_PACKAGE',
									// data:   intent.getStringExtra('uri'),
									data:   apk.nativePath,
									flags:  Ti.Android.FLAG_GRANT_READ_URI_PERMISSION,
									type:   'application/vnd.android.package-archive',
								});

								intent.putExtra('EXTRA_NOT_UNKNOWN_SOURCE', true);
								Ti.Android.currentActivity.startActivity(intent);

							}, 10);
						};

					} catch (error) {

						console.error(error);

						const alertNotice = Ti.UI.createAlertDialog({
							title:       'Auto-update failed',
							message:     'Auto-update failed. Please manually download and update via your browser',
							buttonNames: [ 'Download' ],
						});

						alertNotice.addEventListener('click', async event => {
							if (event.index === 0) {
								Ti.Platform.openURL(appInfo.homepage);
							}
							alertNotice.hide();
						});
						Ti.Analytics.featureEvent('update:fail');
						Alloy.Globals.ACA.logHandledException(e);
						alertNotice.show();
					}
				}

				// Alloy.close('update-required');
				// return resolve();
			};

			const handleIgnoreEvent = async (e, args) => {
				turbo.trace(`📦  you are here → @titanium/updater handling event - updater::ignore`);
				turbo.events.off(`updater::ignore`, handleIgnoreEvent);
				turbo.events.off('updater::update', handleUpdateEvent);
				Alloy.close('update-required');
				turbo.closeLoadingScreen();
				return resolve();
			};


			turbo.events.on('updater::ignore', handleIgnoreEvent);
			turbo.events.on('updater::update', handleUpdateEvent);

			Alloy.open('update-required', { optional: meetsRequired, message: this.message, version: release.version, channel: this.channel });

		})
			.catch(error => {
				console.error('⛔ → Error:  Error occurred in @titanium/updater.ensure()');
				console.error(error);
				console.error(`error: ${JSON.stringify(error, null, 2)}`);
				// resolve();
				// reject(error);
			});
	}

	update() {
		turbo.trace(`📦  you are here → @titanium/updater.update()`);
		turbo.events.fire(`updater::update`);
	}

	ignore() {
		turbo.trace(`📦  you are here → @titanium/updater.ignore()`);
		turbo.events.fire(`updater::ignore`);
	}
}

module.exports = Updater;
