
export type AlbumItem = {
    originalName: string,
    storedName: string
    path: string,
    mediaType: "image" | "video",
    mediaName: string
    uploadedAt: number,
    uploadedBy: string

}

export type AlbumMetaDatas = {
    items: Array<AlbumItem>
}

export type AlbumItem_partial = {
    type: AlbumItem["mediaType"]
    url: `/${string}`
    uploadedBy: string, // Placeholder, replace with actual logic if available
    uploadedAt: number,
    name: AlbumItem["mediaName"],
    duration: number | null
}