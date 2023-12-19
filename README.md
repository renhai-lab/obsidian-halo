# Obsidian plugin for Halo

This repository fork from [obsidian-halo](https://github.com/halo-sigs/obsidian-halo), add some some metadata:
- excerpt str
- url str
- halo.slug str
- halo.cover str only support public accessible image url
- halo.publishTime str YYYY-MM-DDTHH:mm:ssZ
- halo.pinned bool

**attention: Don't switch to a new tag in obsidian until you successfully publish(or pull/update) the article.**

The plugin can synchronize articles between Obsidian and [Halo](https://github.com/halo-dev/halo).

[中文文档](./README.zh-CN.md)

## Installation

~~1. Search for "Halo" in Obsidian's community plugins browser.~~
~~2. Click **Install**.~~

Refer to the development section for manual installation.

## TODO

- [x] i18n
- [ ] Upload images
- [x] Publish this plugin to Obsidian community

## Preview

![settings](./images/settings.png)

![commands](./images/commands.png)

## Development

1. [Create a new Obisidian vault](https://help.obsidian.md/Getting+started/Create+a+vault) for development.
2. Clone this repo to the **plugins folder** of the newly created vault.

   ```bash
   cd path/to/vault/.obsidian/plugins

   git clone https://github.com/ruibaby/obsidian-halo
   ```

3. Install dependencies

   ```bash
   cd obsidian-halo

   npm install
   ```

4. Build the plugin

   ```bash
   npm run dev
   ```

5. Reload Obsidian and enable the plugin in Settings.

## Credits

- [obsidian-wordpress](https://github.com/devbean/obsidian-wordpress): the original idea came from this repo.
