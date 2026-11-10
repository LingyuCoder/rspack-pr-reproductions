use rspack_sources::{Source, SourceMap};
use std::{hint::black_box, time::Instant};

fn main() {
    let mut map = SourceMap::from_bytes(std::fs::read(std::env::args().nth(1).unwrap()).unwrap()).unwrap();
    map.set_file(Some("main.deadbeef.js".into()));
    #[cfg(feature = "head")]
    let original = rspack_sources::DevToolMapSource::new(map);
    #[cfg(not(feature = "head"))]
    let original = rspack_sources::MappingSource::new(map);

    let mut expected = original.buffer().into_owned();
    let pos = expected.windows(8).position(|w| w == b"deadbeef").unwrap();
    expected[pos..pos+8].copy_from_slice(b"12345678");
    #[cfg(feature = "head")]
    let edited = {
        use rspack_sources::SourceExt;
        let mut source = rspack_sources::ReplaceSource::new(original.clone().boxed());
        source.replace(pos as u32, pos as u32 + 8, "12345678".into(), None);
        source
    };
    #[cfg(not(feature = "head"))]
    let edited = original.with_replacements(vec![(pos, pos+8, "12345678".to_owned())], expected.len());
    assert_eq!(edited.buffer().as_ref(), &expected[..]);
    let mut bare = Vec::new();
    let mut times = Vec::new();
    for _ in 0..11 {
        let t = Instant::now();
        for _ in 0..50 { black_box(original.buffer()); }
        bare.push(t.elapsed().as_nanos()/50);
        let t = Instant::now();
        for _ in 0..50 { black_box(edited.buffer()); }
        times.push(t.elapsed().as_nanos()/50);
    }
    bare.sort_unstable();
    times.sort_unstable();
    println!("{{\"bytes\":{},\"bare_ns\":{},\"edited_ns\":{},\"edited_samples\":{:?}}}", expected.len(), bare[5], times[5], times);
}
