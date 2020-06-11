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

		if (!url) {
			this.url = `${this.baseUrl}/${this.id}/${this.platform_lower}/app-info.json`;
		}

		this.appInfoPlease = new Please({
			baseUrl: this.url,
			timeout,
			headers: { 'Cache-Control': 'no-cache' },
		});
		// this.message = message;
	}

	async ensure() {
		turbo.trace('📦  you are here →  @titanium/updater.ensure');
		return new Promise(async (resolve, reject) => {
			const result = await this.appInfoPlease
				.debug(turbo.VERBOSE_MODE)
				.get();

			turbo.trace('📦  you are here →  @titanium/updater.ensure.then()');

			const appInfo = result.json || {};
			turbo.debug(`🦠  appInfo: ${JSON.stringify(appInfo, null, 2)}`);

			if (!appInfo.latest) {
				console.warn(`no app version info found for app: ${this.id} platform: ${this.platform}`);
				return resolve();
			}

			const meetsRequired = semver.satisfies(semver.coerce(this.version), appInfo.required);
			const meetsRecommended = semver.satisfies(semver.coerce(this.version), appInfo.recommended);
			// const meetsOptional = semver.satisfies(semver.coerce(this.version), appInfo.optional);

			console.debug(`🦠  latestVersion: ${JSON.stringify(appInfo.latest, null, 2)}`);
			console.debug(`🦠  meetsRequired: ${JSON.stringify(meetsRequired, null, 2)}`);
			console.debug(`🦠  meetsRecommended: ${JSON.stringify(meetsRecommended, null, 2)}`);
			// console.debug(`🦠  meetsOptional: ${JSON.stringify(meetsOptional, null, 2)}`);

			if (meetsRequired) {
				console.info(`App version ${this.version} meets requirements of: ${appInfo.required}`);

				if (meetsRecommended) {
					console.info(`App version ${this.version} meets recommendations of: ${appInfo.recommended}`);
					return resolve();
				}
			}

			const release = _.find(appInfo.releases, { version: appInfo.latest });

			turbo.events.on(`updater::update`, async (e, args) => {
				turbo.trace(`📦  you are here → @titanium/updater handling event - updater::update`);
				// turbo.events.off(`updater::update`, handleEvent);
				const install_url = release['install-url'];
				// const releaseUrl = 'https://devblog.axway.com';
				console.debug(`🦠  install_url: ${JSON.stringify(install_url, null, 2)}`);
				Alloy.open(turbo.SCREENS_LOADING);
				if (OS_IOS) {
					Titanium.Platform.openURL(install_url, {}, e => {
						turbo.trace(`📦  you are here → @titanium/updater updater::update openURL handler`);
						// Alloy.open(turbo.SCREENS_LOADING);
						// return resolve();
					});
				} else {
					Titanium.Platform.openURL(install_url, {}, e => {
						turbo.trace(`📦  you are here → @titanium/updater updater::update openURL handler`);
						// Alloy.open(turbo.SCREENS_LOADING);
					});

					// Commenting out alternative Android install method for now.  Not working.

					// try {


					// 	const apk = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, 'update.apk');

					// 	const apkPlease = new Please({
					// 		baseUrl: install_url,
					// 		timeout: this.timeout,
					// 		headers: { 'Cache-Control': 'no-cache' },
					// 		file:    apk,
					// 	});

					// 	await apkPlease.get();

					// 	setTimeout(() => {
					// 		let intent = Ti.Android.createIntent({});
					// 		intent.putExtraUri('uri', apk.nativePath);

					// 		intent = Ti.Android.createIntent({
					// 			action: 'android.intent.action.INSTALL_PACKAGE',
					// 			data:   intent.getStringExtra('uri'),
					// 			flags:  Ti.Android.FLAG_GRANT_READ_URI_PERMISSION,
					// 		});

					// 		intent.putExtra('EXTRA_NOT_UNKNOWN_SOURCE', true);
					// 		Ti.Android.currentActivity.startActivity(intent);

					// 	}, 2500);
					// } catch (error) {

					// console.error(error);

					// const alertNotice = Ti.UI.createAlertDialog({
					// 	title:       'Auto-update failed',
					// 	message:     'Auto-update failed. Please manually download and update via your browser',
					// 	buttonNames: [ 'Download' ],
					// });

					// alertNotice.addEventListener('click', async event => {
					// 	if (event.index === 0) {
					// 		Ti.Platform.openURL(appInfo.homepage);
					// 	}
					// });
					// Ti.Analytics.featureEvent('update:fail');
					// Alloy.Globals.ACA.logHandledException(e);
					// alertNotice.show();
					// }
				}

				// Alloy.close('update-required');
				// return resolve();
			});
			turbo.events.on(`updater::ignored`, function handleEvent(e, args) {
				turbo.trace(`📦  you are here → @titanium/updater handling event - updater::ignored`);
				turbo.events.off(`updater::ignored`, handleEvent);
				Alloy.close('update-required');
				return resolve();
			});

			Alloy.open('update-required', { optional: meetsRequired, message: this.message });
			// return reject(new Error(`version ${this.version} does not meet requirements of: ${info.min}`));

			// if (minVersion) {
			// 	satisfied = semver.satisfies(semver.coerce(this.version), minVersion);
			// 	mandatory = !satisfied;
			// 	desiredVersion = minVersion;
			// } else if (appInfo.min) {
			// 	satisfied = semver.gte(semver.coerce(this.version), appInfo.min);
			// 	mandatory = !satisfied;
			// 	desiredVersion = appInfo.min;
			// }

			// if (satisfied && latestVersion) {
			// 	satisfied = semver.gte(semver.coerce(this.version), appInfo.latest);
			// 	mandatory = false;
			// } else if (satisfied && appInfo.latest) {
			// 	satisfied = semver.gte(semver.coerce(this.version), appInfo.latest);
			// 	mandatory = false;
			// }

			// turbo.debug(`satisfied: ${satisfied}`);
			// turbo.debug(`mandatory: ${mandatory}`);

			// console.warn(`appInfo: ${JSON.stringify(appInfo, null, 2)}`);

			// // if (semver.satisfies(this.version, info.min)) {
			// if (satisfied) {
			// 	console.info(`App version ${this.version} meets requirements of: ${desiredVersion}`);
			// 	return resolve();
			// } else {
			// 	console.error(`App version ${this.version} does not meet requirements of: ${desiredVersion}`);

			// 	turbo.events.on(`updater::update`, function handleEvent(e, args) {
			// 		turbo.trace(`📦  you are here → @titanium/updater handling event - updater::update`);
			// 		turbo.events.off(`updater::update`, handleEvent);
			// 		Titanium.Platform.openURL(appInfo['install-url'] || appInfo['update-url']);
			// 		Alloy.close('update-required');
			// 		// return resolve();
			// 	});
			// 	turbo.events.on(`updater::ignored`, function handleEvent(e, args) {
			// 		turbo.trace(`📦  you are here → @titanium/updater handling event - updater::ignored`);
			// 		turbo.events.off(`updater::ignored`, handleEvent);
			// 		Alloy.close('update-required');
			// 		return resolve();
			// 	});

			// 	Alloy.open('update-required', {optional: !mandatory, message: this.message});
			// 	// return reject(new Error(`version ${this.version} does not meet requirements of: ${info.min}`));
			// }
		})
			.catch(error => {
				console.error('⛔ → Error:  Error occurred in @titanium/updater.ensure()');
				console.error(error);
				console.error(`error: ${JSON.stringify(error, null, 2)}`);
				// resolve();
				// reject(error);
			});
		// });
	}

	update() {
		turbo.trace(`📦  you are here → @titanium/updater.update()`);
		turbo.events.fire(`updater::update`);
	}

	ignore() {
		turbo.trace(`📦  you are here → @titanium/updater.ignore()`);
		turbo.events.fire(`updater::ignored`);
	}
}

module.exports = Updater;
