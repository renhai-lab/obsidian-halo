# Obsidian Halo 插件

本仓库fork自 [obsidian-halo](https://github.com/halo-sigs/obsidian-halo), 增加了一些元数据:
- excerpt 文章摘要 str
- url 文章链接 只读
- halo.slug 文章别名 str
- halo.cover 文章封面 str 只支持公开访问的图片链接
- halo.publishTime 发布时间 str YYYY-MM-DDTHH:mm:ssZ
- halo.pinned 是否指定 bool

**注意：在成功发布（或拉取/更新）文章之前，请不要在 obsidian 中切换到新的标签。**

这个插件可以让你将 Obsidian 文档发布到 [Halo](https://github.com/halo-dev/halo)。

[English](./README.md)

## 安装

~~1. 在 Obsidian 的社区插件市场中搜索 **Halo**。~~
~~2. 点击 **安装**。~~

参考开发部分手动安装。

## TODO

- [x] 国际化
- [ ] 上传图片
- [x] 发布此插件到 Obsidian 社区

## 预览

![settings](./images/settings.png)
![commands](./images/commands.png)

## 开发

1. [创建一个新的 Obsidian 仓库](https://help.obsidian.md/Getting+started/Create+a+vault)用于开发。
2. 将此仓库克隆到新创建的文库的 **plugins 文件夹** 中。

   ```bash
   cd path/to/vault/.obsidian/plugins

   git clone <https://github.com/ruibaby/obsidian-halo>
   ```

3. 安装依赖

   ```bash
   cd obsidian-halo

   npm install
   ```

4. 构建插件

   ```bash
   npm run dev
   ```

5. 重新加载 Obsidian 并在设置中启用插件。

## 致谢

- [obsidian-wordpress](https://github.com/devbean/obsidian-wordpress): 最初的想法来源于这个仓库。
