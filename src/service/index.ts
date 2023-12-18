import {Category, PostRequest, Tag} from "@halo-dev/api-client";
import {App, Notice, requestUrl} from "obsidian";
import {HaloSite} from "../settings";
import MarkdownIt from "markdown-it";
import {randomUUID} from "crypto";
import {readMatter} from "../utils/yaml";
import {slugify} from "transliteration";
import i18next from "i18next";

class HaloService {
    private readonly site: HaloSite;
    private readonly app: App;
    private readonly headers: Record<string, string> = {};

    constructor(app: App, site: HaloSite) {
        this.app = app;
        this.site = site;

        this.headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${site.token}`,
        };
    }

    public async getPost(name: string): Promise<PostRequest | undefined> {
        try {
            const post = await requestUrl({
                url: `${this.site.url}/apis/content.halo.run/v1alpha1/posts/${name}`,
                headers: this.headers,
            });

            const content = await requestUrl({
                url: `${this.site.url}/apis/api.console.halo.run/v1alpha1/posts/${name}/head-content`,
                headers: this.headers,
            });

            return Promise.resolve({
                post: post.json,
                content: content.json,
            });
        } catch (error) {
            return Promise.resolve(undefined);
        }
    }

    public async publishPost(): Promise<void> {
        const {activeEditor} = this.app.workspace;

        if (!activeEditor || !activeEditor.file) {
            return;
        }

        let params: PostRequest = {
            post: {
                spec: {
                    title: "",
                    slug: "",
                    template: "",
                    cover: "",
                    deleted: false,
                    publish: false,
                    publishTime: undefined,
                    pinned: false,
                    allowComment: true,
                    visible: "PUBLIC",
                    priority: 0,
                    excerpt: {
                        autoGenerate: true,
                        raw: "",
                    },
                    categories: [],
                    tags: [],
                    htmlMetas: [],
                },
                apiVersion: "content.halo.run/v1alpha1",
                kind: "Post",
                metadata: {
                    name: "",
                    annotations: {},
                }
            },
            content: {
                raw: "",
                content: "",
                rawType: "markdown",
            }
        };

        const {content: raw} = readMatter(await this.app.vault.read(activeEditor.file));
        const matterData = this.app.metadataCache.getFileCache(activeEditor.file)?.frontmatter;

        // check site url
        if (matterData?.halo?.site && matterData.halo.site !== this.site.url) {
            new Notice(i18next.t("service.error_site_not_match"));
            return;
        }

        if (matterData?.halo?.name) {
            const post = await this.getPost(matterData.halo.name);
            params = post ? post : params;
        }

        params.content.raw = raw;
        params.content.content = new MarkdownIt({
            html: true,
            xhtmlOut: true,
            breaks: true,
            linkify: true,
            typographer: true,
        }).render(raw);

        // restore metadata
        if (matterData?.title) {
            params.post.spec.title = matterData.title;
        }

        if (matterData?.categories) {
            const categoryNames = await this.getCategoryNames(matterData.categories);
            params.post.spec.categories = categoryNames;
        }

        if (matterData?.tags) {
            const tagNames = await this.getTagNames(matterData.tags);
            params.post.spec.tags = tagNames;
        }

        // add cover
        if (matterData?.halo?.cover) {
            params.post.spec.cover = matterData.halo.cover;
        }

        // add excerpt
        if (matterData?.excerpt && matterData.excerpt !== "") {
            params.post.spec.excerpt = {
                autoGenerate: false,
                raw: matterData.excerpt
            };
        } else {
            params.post.spec.excerpt = {
                autoGenerate: true,
                raw: "",
            };
        }

        // add slug
        // 获取前置元数据中的 slug
        const slug = matterData?.halo?.slug;
        // 验证 slug
        if (slug && !isValidSlug(slug)) {
            new Notice(i18next.t("service.invalid_slug_format"));
            console.error(i18next.t("service.invalid_slug_format"));
            return;
        } else if (slug && isValidSlug(slug)) {
            params.post.spec.slug = slug;
        }
        
        // url
      let urlsMatch; // 在if语句之外声明urlsMatch变量
      if (matterData?.url) {
        const oldlinks = params.post.status.permalink.split("/").pop() || undefined;
        const newlink = matterData.url.split("/").pop();
        console.info(oldlinks, newlink)
        console.info(oldlinks == newlink)
        urlsMatch = oldlinks == newlink; // 存储比较结果
      } 
      
      // 在if语句之外访问urlsMatch
      console.log(urlsMatch);
      
        // add publishTime
        const publishTime = matterData?.halo?.publishTime
        // 验证 publishTime
        if (publishTime && !isValidPublishTime(publishTime)) {
            console.error("Invalid publishTime format in publishPost function: ", publishTime);
            new Notice(i18next.t("service.invalid_publish_time_format"));
            return;
        } else if (publishTime && isValidPublishTime(publishTime)) {
            params.post.spec.publishTime = publishTime;
        }

        // add pinned
        if (matterData?.halo?.pinned) {
            params.post.spec.pinned = matterData.halo.pinned;
        }


        try {
            if (params.post.metadata.name) {
                // 更新已存在的文章...
                const {name} = params.post.metadata;
                // 发送请求更新文章的基本信息
                await requestUrl({
                    url: `${this.site.url}/apis/content.halo.run/v1alpha1/posts/${name}`,
                    method: "PUT",
                    contentType: "application/json",
                    headers: this.headers,
                    body: JSON.stringify(params.post),
                });
                // 发送请求更新文章的内容
                await requestUrl({
                    url: `${this.site.url}/apis/api.console.halo.run/v1alpha1/posts/${params.post.metadata.name}/content`,
                    method: "PUT",
                    contentType: "application/json",
                    headers: this.headers,
                    body: JSON.stringify(params.content),
                });
            } else {
                // 创建新文章, 自动生成以下内容
                // 新增一个随机的 UUID 作为文章的名称
                params.post.metadata.name = randomUUID();
                // 设置文章标题和别名...
                params.post.spec.title = matterData?.title || activeEditor.file.basename;
                // 根据title 生成 slug
                params.post.spec.slug = slug || slugify(params.post.spec.title, {trim: true, lowercase: true});
                // 根据时间生成 publishTime
                params.post.spec.publishTime = publishTime || formatToIsoString(new Date(Date.now()));

                const post = await requestUrl({
                    // 发送请求创建新文章
                    url: `${this.site.url}/apis/api.console.halo.run/v1alpha1/posts`,
                    method: "POST",
                    contentType: "application/json",
                    headers: this.headers,
                    body: JSON.stringify(params),
                }).json;


                params.post = post;
            }

            // Publish post
            // 根据文章的前置元数据中的 publish 字段，决定是发布还是撤销发布文章。
            if (matterData?.halo?.publish) {
                // 发送请求发布文章
                await requestUrl({
                    url: `${this.site.url}/apis/api.console.halo.run/v1alpha1/posts/${params.post.metadata.name}/publish`,
                    method: "PUT",
                    contentType: "application/json",
                    headers: this.headers,
                });
            } else {
                // 发送请求撤销发布文章
                await requestUrl({
                    url: `${this.site.url}/apis/api.console.halo.run/v1alpha1/posts/${params.post.metadata.name}/unpublish`,
                    method: "PUT",
                    contentType: "application/json",
                    headers: this.headers,
                });
            }

            params = (await this.getPost(params.post.metadata.name)) || params;
        } catch (error) {
            new Notice(i18next.t("service.error_publish_failed"));
            return;
        }


        const postCategories = await this.getCategoryDisplayNames(params.post.spec.categories);
        const postTags = await this.getTagDisplayNames(params.post.spec.tags);
        const postSlug = params.post.spec.slug;
        // 增加halo自动生成的url
        const postUrl = generatePostUrl(this.site.url, postSlug);
        if (!urlsMatch) {
          console.error(i18next.t("service.url_only_read"))
          new Notice(i18next.t("service.url_only_read"));
          
        } 
        
        
        this.app.fileManager.processFrontMatter(activeEditor.file, (frontmatter) => {
            frontmatter.title = params.post.spec.title;
            frontmatter.url = postUrl;
            frontmatter.categories = postCategories;
            frontmatter.tags = postTags;
            frontmatter.excerpt = params.post.spec.excerpt.raw;
            frontmatter.halo = {
                site: this.site.url,
                name: params.post.metadata.name,
                slug: postSlug,
                cover: params.post.spec.cover,
                publish: params.post.spec.publish,
                publishTime: params.post.spec.publishTime,
                pinned: params.post.spec.pinned,
            };
        });
        

        
        new Notice(i18next.t("service.notice_publish_success"));
    }

    public async getCategories(): Promise<Category[]> {
        const data = await requestUrl({
            url: `${this.site.url}/apis/content.halo.run/v1alpha1/categories`,
            headers: this.headers,
        });
        return Promise.resolve(data.json.items);
    }

    public async getTags(): Promise<Tag[]> {
        const data = await requestUrl({
            url: `${this.site.url}/apis/content.halo.run/v1alpha1/tags`,
            headers: this.headers,
        });
        return Promise.resolve(data.json.items);
    }

    public async updatePost(): Promise<void> {
        const {activeEditor} = this.app.workspace;

        if (!activeEditor || !activeEditor.file) {
            return;
        }

        const matterData = this.app.metadataCache.getFileCache(activeEditor.file)?.frontmatter;

        if (!matterData?.halo?.name) {
            new Notice(i18next.t("service.error_not_published"));
            return;
        }

        const post = await this.getPost(matterData.halo.name);

        if (!post) {
            new Notice(i18next.t("service.error_post_not_found"));
            return;
        }
        // 更新文章的基本信息: 文章分类和标签
        const postCategories = await this.getCategoryDisplayNames(post.post.spec.categories);
        const postTags = await this.getTagDisplayNames(post.post.spec.tags);
        const postSlug = post.post.spec.slug;
        // 增加halo自动生成的url
        const postUrl = generatePostUrl(this.site.url, postSlug);

        // 更新文章的内容
        await this.app.vault.modify(activeEditor.file, post.content.raw + "");
        // 更新文章的前置元数据
        this.app.fileManager.processFrontMatter(activeEditor.file, (frontmatter) => {
            frontmatter.title = post.post.spec.title;
            frontmatter.categories = postCategories;
            frontmatter.tags = postTags;
            frontmatter.excerpt = post.post.spec.excerpt.raw;
            frontmatter.url = postUrl;
            frontmatter.halo = {
                site: this.site.url,
                name: post.post.metadata.name,
                slug: post.post.spec.slug,
                cover: post.post.spec.cover,
                publish: post.post.spec.publish,
                publishTime: post.post.spec.publishTime,
                pinned: post.post.spec.pinned,
            };
        });
    }

    public async pullPost(name: string): Promise<void> {
        const post = await this.getPost(name);

        if (!post) {
            new Notice(i18next.t("service.error_post_not_found"));
            return;
        }
        const postCategories = await this.getCategoryDisplayNames(post.post.spec.categories);
        const postTags = await this.getTagDisplayNames(post.post.spec.tags);
        const postSlug = post.post.spec.slug;
        // 增加halo自动生成的url
        const postUrl = generatePostUrl(this.site.url, postSlug);

        this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            frontmatter.title = post.post.spec.title;
            frontmatter.categories = postCategories;
            frontmatter.tags = postTags;
            frontmatter.excerpt = post.post.spec.excerpt.raw;
            frontmatter.url = postUrl;
            frontmatter.halo = {
                site: this.site.url,
                name: post.post.metadata.name,
                slug: postSlug,
                cover: post.post.spec.cover,
                publish: post.post.spec.publish,
                publishTime: post.post.spec.publishTime,
                pinned: post.post.spec.pinned,
            };
        });
    }

    public async getCategoryNames(displayNames: string[]): Promise<string[]> {
        // 获取所有分类
        const allCategories = await this.getCategories();
        // 获取不存在的分类
        const notExistDisplayNames = displayNames.filter(
            (name) => !allCategories.find((item) => item.spec.displayName === name),
        );
        // 创建不存在的分类
        const promises = notExistDisplayNames.map((name, index) =>
            requestUrl({
                url: `${this.site.url}/apis/content.halo.run/v1alpha1/categories`,
                method: "POST",
                contentType: "application/json",
                headers: this.headers,
                body: JSON.stringify({
                    spec: {
                        displayName: name,
                        slug: slugify(name, {trim: true}),
                        description: "",
                        cover: "",
                        template: "",
                        priority: allCategories.length + index,
                        children: [],
                    },
                    apiVersion: "content.halo.run/v1alpha1",
                    kind: "Category",
                    metadata: {name: "", generateName: "category-"},
                }),
            }),
        );

        const newCategories = await Promise.all(promises);

        const existNames = displayNames
            .map((name) => {
                const found = allCategories.find((item) => item.spec.displayName === name);
                return found ? found.metadata.name : undefined;
            })
            .filter(Boolean) as string[];

        return [...existNames, ...newCategories.map((item) => item.json.metadata.name)];
    }

    public async getCategoryDisplayNames(names?: string[]): Promise<string[]> {
        const categories = await this.getCategories();
        return names
            ?.map((name) => {
                const found = categories.find((item) => item.metadata.name === name);
                return found ? found.spec.displayName : undefined;
            })
            .filter(Boolean) as string[];
    }

    public async getTagNames(displayNames: string[]): Promise<string[]> {
        const allTags = await this.getTags();

        const notExistDisplayNames = displayNames.filter((name) => !allTags.find((item) => item.spec.displayName === name));

        const promises = notExistDisplayNames.map((name) =>
            requestUrl({
                url: `${this.site.url}/apis/content.halo.run/v1alpha1/tags`,
                method: "POST",
                contentType: "application/json",
                headers: this.headers,
                body: JSON.stringify({
                    spec: {
                        displayName: name,
                        slug: slugify(name, {trim: true}),
                        color: "#ffffff",
                        cover: "",
                    },
                    apiVersion: "content.halo.run/v1alpha1",
                    kind: "Tag",
                    metadata: {name: "", generateName: "tag-"},
                }),
            }),
        );

        const newTags = await Promise.all(promises);

        const existNames = displayNames
            .map((name) => {
                const found = allTags.find((item) => item.spec.displayName === name);
                return found ? found.metadata.name : undefined;
            })
            .filter(Boolean) as string[];

        return [...existNames, ...newTags.map((item) => item.json.metadata.name)];
    }

    public async getTagDisplayNames(names?: string[]): Promise<string[]> {
        const tags = await this.getTags();
        return names
            ?.map((name) => {
                const found = tags.find((item) => item.metadata.name === name);
                return found ? found.spec.displayName : undefined;
            })
            .filter(Boolean) as string[];
    }
}


function generatePostUrl(siteUrl: string, slug: string): string {
    const baseUrl = siteUrl.replace(/\/+$/, "");
    return `${baseUrl}/archives/${slug}`;
}


function formatToIsoString(date: Date): string {
    // 将日期转换为ISO格式并截断到秒
    return date.toISOString().split('.')[0] + 'Z';
}

function isValidPublishTime(publishTime: string): boolean {
    const parsedDate = new Date(publishTime);
    if (isNaN(parsedDate.getTime())) {
        // 无法解析为有效日期
        return false;
    }

    // 根据原始字符串的精度调整publishTime
    const adjustedPublishTime = publishTime.includes('.')
        ? publishTime.split('.')[0] + 'Z'
        : publishTime;
    // 使用formatToIsoString函数格式化日期
    const isoString = formatToIsoString(parsedDate);
    return isoString === adjustedPublishTime;
}

function isValidSlug(slug: string): boolean {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
}


export default HaloService;
