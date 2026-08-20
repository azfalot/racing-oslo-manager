import { Jimp } from 'jimp';

async function testJimp() {
  try {
    const bg = await Jimp.read('web/public/media/signing_template.jpg');
    console.log('Jimp works!', bg.width, bg.height);
  } catch (e) {
    console.log('Jimp error:', e);
  }
}
testJimp();
