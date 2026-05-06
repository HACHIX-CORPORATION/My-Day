import { useState } from 'react'

const guest = "https://res.cloudinary.com/du63kkxhl/image/upload/v1675013009/guest_f8d60j.png"

function resizeToBase64(file, maxSize = 200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = ev => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  })
}

export function ImgUploader({ onUploaded = null }) {
  const [preview, setPreview] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(ev) {
    const file = ev.target.files[0]
    if (!file) return
    setIsUploading(true)
    const base64 = await resizeToBase64(file)
    setPreview(base64)
    setIsUploading(false)
    onUploaded && onUploaded(base64)
  }

  return (
    <div className="upload-preview">
      <div className='img-picker'>
        {preview ? 'Upload Another?' : isUploading ? 'Uploading....' : 'Upload a profile picture'}
        <label htmlFor="imgUpload">
          {!preview && <img className="guest-img" src={guest} style={{ maxWidth: '200px', float: 'right' }} alt="" />}
          {preview && <img className="user-img" src={preview} style={{ maxWidth: '100px', float: 'right' }} alt="" />}
        </label>
      </div>
      <input type="file" onChange={handleFile} accept="image/*" id="imgUpload" />
    </div>
  )
}
